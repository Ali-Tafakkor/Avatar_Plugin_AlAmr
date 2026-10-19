import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWebAvatarRuntime, EMOTIONS } from '../src/runtime.mjs';
import { loadRealAvatar } from './load-real-avatar.mjs';

// Geometry, the actual rig and every face target come from the recoverable GLB.
// The Node fixture omits image decoding; these tests do not prove texture rendering.
const { gltf, motions } = await loadRealAvatar();
const idle = {
  state: 'idle', horizontalSpeed: 0, verticalSpeed: 0, grounded: true,
};
const poseAt = (position = [0, 0, 0], yaw = 0) => ({
  position, velocity: [0, 0, 0], yaw, mode: 'grounded',
});
const cameraAt = (x = 0, y = 1.6, z = 3) => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(x, y, z);
  return camera;
};
const advance = (runtime, frames = 90, frame = {}) => {
  const input = { pose: poseAt(), locomotion: idle, camera: cameraAt(), ...frame };
  for (let index = 0; index < frames; index++) runtime.update(1 / 60, input);
};
const meshesOf = root => {
  const meshes = [];
  root.traverse(node => { if (node.isMesh) meshes.push(node); });
  return meshes;
};
const bindingsOf = root => meshesOf(root).flatMap(node =>
  Object.entries(node.morphTargetDictionary ?? {}).map(([name, index]) => ({ node, name, index })),
);

test('runtime leaves the host position and heading authoritative and grounds real soles in that world', async () => {
  const groundSamples = [];
  const runtime = await createWebAvatarRuntime(gltf, motions, {
    groundAt(x, z) { groundSamples.push([x, z]); return 3.2; },
  });
  try {
    const host = new THREE.Group(), facing = new THREE.Group();
    host.position.set(4, 3.2, -2); host.rotation.y = 1.1;
    facing.rotation.y = Math.PI; host.add(facing); facing.add(runtime.root);
    const hostPosition = host.position.clone(), hostQuaternion = host.quaternion.clone();
    const localPosition = runtime.root.position.clone(), localQuaternion = runtime.root.quaternion.clone();
    const frame = { pose: poseAt([4, 3.2, -2], 1.1), camera: cameraAt(4, 4.8, 1) };
    advance(runtime, 120, frame);
    assert.deepEqual(host.position.toArray(), hostPosition.toArray());
    assert.ok(host.quaternion.angleTo(hostQuaternion) < 1e-10);
    assert.deepEqual(runtime.root.position.toArray(), localPosition.toArray());
    assert.ok(runtime.root.quaternion.angleTo(localQuaternion) < 1e-10);
    assert.ok(runtime.root.getWorldPosition(new THREE.Vector3()).distanceTo(hostPosition) < 1e-10,
      'pose.position must not be applied again beneath the host root');
    const expectedHeading = hostQuaternion.clone().multiply(facing.quaternion);
    assert.ok(runtime.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(expectedHeading) < 1e-7,
      'pose.yaw must not be applied again beneath the host root');
    const state = runtime.getStatus();
    assert.equal(state.state, 'idle'); assert.equal(state.clip, 'idle');
    for (const [side, foot] of Object.entries(state.feet)) {
      assert.ok(Math.abs(foot.soleMinY - 3.2) < 0.0001, `${side} world sole: ${foot.soleMinY}`);
      assert.ok(Math.abs(foot.rollDeg) < 0.1, `${side} roll: ${foot.rollDeg}`);
      assert.ok(Math.abs(foot.pitchDeg) < 0.1, `${side} pitch: ${foot.pitchDeg}`);
    }
    assert.ok(groundSamples.length > 200);
    assert.ok(groundSamples.every(([x, z]) => Math.abs(x - 4) < 1 && Math.abs(z + 2) < 1),
      'ground queries must use the transformed feet, not avatar-local coordinates');
  } finally { runtime.dispose(); }
});

test('runtime public face controls bind all 66 channels, all six presets and an actual close/open blink', async () => {
  const runtime = await createWebAvatarRuntime(gltf, motions);
  try {
    runtime.setFaceOptions({ blinkEnabled: false, gazeEnabled: false, microEnabled: false });
    runtime.setIntensity(0.76);
    const bindings = bindingsOf(runtime.root), uniqueNames = new Set(bindings.map(value => value.name));
    assert.equal(uniqueNames.size, 66);
    assert.equal(runtime.getStatus().morphCount, 66);
    assert.deepEqual(runtime.getStatus().missingShapes, []);
    const signatures = new Set();
    for (const [name, preset] of Object.entries(EMOTIONS)) {
      runtime.setEmotion(name); advance(runtime);
      const state = runtime.getStatus();
      assert.equal(state.emotion, name);
      for (const [shape, target] of Object.entries(preset.values)) {
        const actual = bindings.filter(binding => binding.name === shape);
        assert.ok(actual.length > 0, `${name}: missing rendered ${shape}`);
        for (const binding of actual) assert.ok(
          Math.abs(binding.node.morphTargetInfluences[binding.index] - target * 0.76) < 0.001,
          `${name}: ${binding.node.name}.${shape} did not receive the public preset`,
        );
      }
      for (const { node, name: shape, index } of bindings) {
        const influence = node.morphTargetInfluences[index];
        assert.ok(Number.isFinite(influence) && influence >= 0 && influence <= 1);
        assert.ok(Math.abs(influence - (state.weights[shape] ?? 0)) < 1e-10,
          `${node.name}.${shape}: generated weights did not reach the rendered mesh`);
      }
      signatures.add(JSON.stringify(bindings.map(({ node, index }) => node.morphTargetInfluences[index].toFixed(3))));
    }
    assert.equal(signatures.size, 6);
    runtime.setEmotion('neutral'); advance(runtime);
    runtime.setManual('jaw', 0.61); advance(runtime);
    assert.ok(bindings.filter(binding => binding.name === 'jawOpen').every(binding =>
      Math.abs(binding.node.morphTargetInfluences[binding.index] - 0.61) < 0.001));
    runtime.blink();
    let peakLeft = 0, peakRight = 0;
    const blinkFrame = { pose: poseAt(), locomotion: idle, camera: cameraAt() };
    for (let index = 0; index < 48; index++) {
      runtime.update(1 / 120, blinkFrame);
      for (const binding of bindings) {
        const influence = binding.node.morphTargetInfluences[binding.index];
        if (binding.name === 'eyeBlinkLeft') peakLeft = Math.max(peakLeft, influence);
        if (binding.name === 'eyeBlinkRight') peakRight = Math.max(peakRight, influence);
      }
    }
    assert.ok(peakLeft > 0.9 && peakRight > 0.9, `rendered blink peaks: ${peakLeft}, ${peakRight}`);
    assert.ok(bindings.filter(binding => /^eyeBlink(Left|Right)$/.test(binding.name)).every(binding =>
      binding.node.morphTargetInfluences[binding.index] === 0), 'both rendered eyes reopen');
  } finally { runtime.dispose(); }
});

test('equivalent world cameras give the same facial gaze even when one camera has a transformed parent', async () => {
  const parented = await createWebAvatarRuntime(gltf, motions);
  let world;
  try {
    world = await createWebAvatarRuntime(gltf, motions);
    const cameraParent = new THREE.Group(), childCamera = cameraAt(0, 1.2, 3);
    cameraParent.position.set(3, 0.4, 0); cameraParent.rotation.y = 0.4; cameraParent.add(childCamera);
    const worldCamera = new THREE.PerspectiveCamera();
    worldCamera.position.copy(childCamera.getWorldPosition(new THREE.Vector3()));
    for (const runtime of [parented, world]) runtime.setFaceOptions({ blinkEnabled: false, microEnabled: false });
    advance(parented, 90, { camera: childCamera, portrait: true });
    advance(world, 90, { camera: worldCamera, portrait: true });
    const first = parented.getStatus().weights, second = world.getStatus().weights;
    for (const name of ['eyeLookOutLeft', 'eyeLookInRight', 'eyeLookUpLeft', 'eyeLookDownRight']) {
      assert.ok(Math.abs((first[name] ?? 0) - (second[name] ?? 0)) < 1e-6, name);
    }
    assert.ok(first.eyeLookOutLeft > 0.2, 'the eyes must respond to the camera world offset');
  } finally { parented.dispose(); world?.dispose(); }
});

test('runtime clones keep independent skeletons, materials and face influences and dispose only their own resources once', async () => {
  const first = await createWebAvatarRuntime(gltf, motions);
  let second;
  try {
    second = await createWebAvatarRuntime(gltf, motions);
    const host = new THREE.Group(); host.add(first.root, second.root);
    const sourceMeshes = meshesOf(gltf.scene), firstMeshes = meshesOf(first.root), secondMeshes = meshesOf(second.root);
    const cachedFace = sourceMeshes.find(mesh => mesh.name === 'AvatarHead');
    const originalInfluences = [...cachedFace.morphTargetInfluences];
    for (const source of sourceMeshes) {
      const a = firstMeshes.find(mesh => mesh.name === source.name), b = secondMeshes.find(mesh => mesh.name === source.name);
      assert.notEqual(a.geometry, source.geometry); assert.notEqual(a.geometry, b.geometry);
      assert.notEqual(a.material, source.material); assert.notEqual(a.material, b.material);
      assert.deepEqual(a.geometry.attributes.position.array, source.geometry.attributes.position.array);
      if (a.isSkinnedMesh) {
        assert.notEqual(a.skeleton, b.skeleton);
        assert.ok(a.skeleton.bones.every((bone, index) => bone !== b.skeleton.bones[index] && bone !== source.skeleton.bones[index]));
      }
      if (a.morphTargetInfluences) assert.notEqual(a.morphTargetInfluences, b.morphTargetInfluences);
    }
    first.setEmotion('laugh'); second.setEmotion('neutral');
    for (const runtime of [first, second]) runtime.setFaceOptions({ blinkEnabled: false, gazeEnabled: false, microEnabled: false });
    advance(first); advance(second);
    const aHead = firstMeshes.find(mesh => mesh.name === 'AvatarHead'), bHead = secondMeshes.find(mesh => mesh.name === 'AvatarHead');
    const smileIndex = aHead.morphTargetDictionary.mouthSmileLeft;
    assert.ok(aHead.morphTargetInfluences[smileIndex] > 0.6);
    assert.equal(bHead.morphTargetInfluences[smileIndex], 0);
    assert.deepEqual(cachedFace.morphTargetInfluences, originalInfluences);
    let ownedGeometryDisposals = 0, ownedMaterialDisposals = 0, otherDisposals = 0;
    aHead.geometry.addEventListener('dispose', () => ownedGeometryDisposals++);
    aHead.material.addEventListener('dispose', () => ownedMaterialDisposals++);
    for (const mesh of [bHead, cachedFace]) {
      mesh.geometry.addEventListener('dispose', () => otherDisposals++);
      mesh.material.addEventListener('dispose', () => otherDisposals++);
    }
    first.dispose(); first.dispose();
    assert.equal(ownedGeometryDisposals, 1); assert.equal(ownedMaterialDisposals, 1); assert.equal(otherDisposals, 0);
    assert.equal(first.root.parent, null); assert.equal(second.root.parent, host);
    const stoppedWeights = [...aHead.morphTargetInfluences];
    advance(first, 2); assert.deepEqual(aHead.morphTargetInfluences, stoppedWeights);
    second.setEmotion('surprise'); advance(second);
    assert.equal(second.getStatus().disposed, false);
    assert.ok(bHead.morphTargetInfluences[bHead.morphTargetDictionary.jawOpen] > 0.4);
  } finally { first.dispose(); second?.dispose(); }
});
