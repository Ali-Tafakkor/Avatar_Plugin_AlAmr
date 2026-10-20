import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { createHybridRuntime } from '../dist/hybrid/runtime.mjs';
import { EMOTIONS, FACE_GROUPS } from '../dist/web-v2/runtime.mjs';
import { loadHybridAssets } from './load-hybrid-assets.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = await loadHybridAssets();
const originalGeometry = gltf => {
  const hash = createHash('sha256');
  gltf.scene.traverse(node => {
    if (node.isBone) hash.update(JSON.stringify([node.name, ...node.position, ...node.quaternion, ...node.scale]));
    if (!node.isMesh) return;
    hash.update(JSON.stringify((Array.isArray(node.material) ? node.material : [node.material])
      .map(material => [material.transparent, material.depthWrite, material.alphaTest])));
    const attributes = [...Object.entries(node.geometry.attributes),
      ...Object.entries(node.geometry.morphAttributes).flatMap(([name, values]) => values.map((value, index) => [name + index, value]))];
    if (node.geometry.index) attributes.push(['index', node.geometry.index]);
    for (const [name, value] of attributes) {
      hash.update(name); hash.update(Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength));
    }
  });
  return hash.digest('hex');
};
const cached = { legacy: originalGeometry(fixture.legacy), web: originalGeometry(fixture.web) };
const camera = new PerspectiveCamera(); camera.position.set(8, 4.8, -2);
const frame = (state = 'idle', grounded = true, y = 0, vy = 0, speed = 0) => ({
  pose: { position: [8, 3.2 + y, -7], velocity: [0, vy, -speed], yaw: 1.8, mode: state === 'fly' ? 'flying' : 'grounded' },
  locomotion: { state, grounded, horizontalSpeed: speed, verticalSpeed: vy }, camera,
});
const faceMeshes = runtime => [...new Set(runtime.face.bindings.map(binding => binding.node))];
test('hybrid dist is a closed package-local import graph and matches its frozen accepted algorithm fingerprints', async () => {
  const provenance = JSON.parse(await fs.readFile(new URL('../dist/hybrid/accepted-source.json', import.meta.url), 'utf8'));
  for (const file of provenance.files) {
    assert.equal(sha(await fs.readFile(new URL('../dist/hybrid/' + file.file, import.meta.url))), file.packageLocalSha256, file.file);
  }
  const dist = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url))), visited = new Set();
  const visit = async url => {
    const resolved = path.resolve(fileURLToPath(url));
    assert.ok(resolved.startsWith(dist + path.sep), 'import escapes built package: ' + resolved);
    if (visited.has(resolved)) return; visited.add(resolved);
    const source = await fs.readFile(url, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      assert.ok(!/avatar-lab|experiments|assets-source|https?:|\.\.\/\.\.\//.test(specifier), specifier);
      if (specifier.startsWith('.')) await visit(new URL(specifier, url));
      else assert.ok(/^(three(?:\/|$)|react(?:\/|$)|@react-three\/fiber$)/.test(specifier), 'unexpected runtime dependency ' + specifier);
    }
  };
  await visit(new URL('../dist/index.js', import.meta.url));
  const exported = await import('../dist/index.js');
  assert.equal(typeof exported.AvatarHybrid, 'object'); assert.equal(exported.createHybridRuntime, createHybridRuntime);
  assert.equal(typeof exported.Avatar03, 'object'); assert.equal(typeof exported.AvatarWebV2, 'object');
  assert.equal(exported.AVATAR_HYBRID_HEIGHT, 1.78);
  for (const name of ['AVATAR_HYBRID_LEGACY_MODEL_URL', 'AVATAR_HYBRID_MODEL_URL', 'AVATAR_HYBRID_MOTIONS_URL', 'AVATAR_HYBRID_TEXTURE_URL']) {
    await fs.access(new URL(exported[name]));
  }
  assert.equal(sha(fixture.legacyBytes), 'bf16883394c2f968faa294e8debe02dc38ff8ba4aaf98d32319e025d8185540d');
  assert.ok(visited.size >= 10);
});

test('built hybrid instances isolate both native rigs and face resources and dispose without affecting the cached assets', async () => {
  const first = await createHybridRuntime(fixture.legacy, fixture.web, fixture.motions);
  const second = await createHybridRuntime(fixture.legacy, fixture.web, fixture.motions);
  try {
    const a = faceMeshes(first).find(mesh => mesh.name === 'AvatarHead'), b = faceMeshes(second).find(mesh => mesh.name === 'AvatarHead');
    assert.notEqual(a.geometry, b.geometry); assert.notEqual(a.material, b.material); assert.notEqual(a.skeleton, b.skeleton);
    assert.ok(a.skeleton.bones.every((bone, index) => bone !== b.skeleton.bones[index]));
    assert.ok([...first.body.bones].every(([name, bone]) => bone !== second.body.bones.get(name)));
    for (const [name, index] of Object.entries(a.morphTargetDictionary)) {
      assert.notEqual(a.geometry.morphAttributes.position[index].array, b.geometry.morphAttributes.position[b.morphTargetDictionary[name]].array);
    }
    first.setEmotion('laugh'); first.update(0.1, frame());
    assert.deepEqual(second.getStatus().weights, {});
    let geometries = 0, materials = 0, other = 0;
    a.geometry.addEventListener('dispose', () => geometries++); a.material.addEventListener('dispose', () => materials++);
    b.geometry.addEventListener('dispose', () => other++); b.material.addEventListener('dispose', () => other++);
    first.dispose(); first.dispose();
    assert.equal(geometries, 1); assert.equal(materials, 1); assert.equal(other, 0);
    second.setEmotion('smile'); second.update(0.1, frame()); assert.ok(second.getStatus().weights.mouthSmileLeft > 0);
    assert.equal(originalGeometry(fixture.legacy), cached.legacy); assert.equal(originalGeometry(fixture.web), cached.web);
  } finally { first.dispose(); second.dispose(); }
});

test('standalone hybrid applies all six public emotions, a blink and all 37 effective native face controls', async context => {
  const runtime = await createHybridRuntime(fixture.legacy, fixture.web, fixture.motions);
  try {
    runtime.previewClip('HandRaise'); runtime.setPlayback({ paused: true }); runtime.seekClip(1.5);
    runtime.setFaceOptions({ blinkEnabled: false, gazeEnabled: false, microEnabled: false }); runtime.setIntensity(1);
    const beforeBody = bodyPoseSnapshot(runtime), signatures = new Set();
    assert.equal(runtime.face.shapes.size, 66); assert.deepEqual(runtime.face.missing, []);
    const nativeHead = faceMeshes(runtime).find(mesh => mesh.name === 'AvatarHead');
    assert.equal(nativeHead.skeleton.bones.length, 73);
    assert.ok(nativeHead.skeleton.bones.every(bone => bone.userData.hybridFaceBone));
    for (const [name, preset] of Object.entries(EMOTIONS)) {
      runtime.setEmotion(name);
      for (let i = 0; i < 70; i++) runtime.update(0.05, frame());
      assert.equal(runtime.getStatus().emotion, name);
      for (const [shape, expected] of Object.entries(preset.values)) {
        const bindings = runtime.face.bindings.filter(binding => binding.normalized === shape.toLowerCase());
        assert.ok(bindings.length, name + ':' + shape);
        for (const binding of bindings) assert.ok(Math.abs(binding.node.morphTargetInfluences[binding.index] - expected) < 0.001);
      }
      signatures.add(JSON.stringify(runtime.face.bindings.map(binding => binding.node.morphTargetInfluences[binding.index].toFixed(3))));
    }
    assert.equal(signatures.size, 6);
    runtime.setEmotion('neutral'); runtime.setManual('jaw', 0.61);
    for (let i = 0; i < 70; i++) runtime.update(0.05, frame());
    assert.ok(runtime.getStatus().weights.jawOpen > 0.609);
    runtime.blink(); runtime.update(0.07, frame());
    assert.ok(runtime.getStatus().weights.eyeBlinkLeft > 0.99); assert.ok(runtime.getStatus().weights.eyeBlinkRight > 0.97);
    // Static ankle contact is the accepted explicit body exception; face work
    // must leave every other native V1 local joint exactly as sampled.
    const afterBody = bodyPoseSnapshot(runtime);
    for (const [name, pose] of beforeBody) if (!/foot$|toebase$/.test(name)) assert.deepEqual(afterBody.get(name), pose);
    const active = [...new Set([...Object.values(EMOTIONS).flatMap(preset => Object.keys(preset.values)),
      ...Object.values(FACE_GROUPS).flat(), 'eyeBlinkLeft', 'eyeBlinkRight',
      ...['Up', 'Down', 'In', 'Out'].flatMap(direction => ['Left', 'Right'].map(side => 'eyeLook' + direction + side))])];
    assert.equal(active.length, 37);
    const meshes = faceMeshes(runtime);
    runtime.setInspectionFace({}); runtime.actor.refresh();
    const neutral = new Map(meshes.map(mesh => [mesh, new Map([...new Set(mesh.geometry.index.array)].map(index =>
      [index, mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld)]))]));
    let smallest = { channel: '', displacementMeters: Infinity };
    for (const channel of active) {
      runtime.setInspectionFace({ [channel]: 1 }); runtime.actor.refresh();
      let maximum = 0;
      for (const mesh of meshes) for (const [index, point] of neutral.get(mesh)) {
        maximum = Math.max(maximum, mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(point));
      }
      assert.ok(maximum > 0.001, channel + ' must move referenced visible geometry by at least 1mm');
      if (maximum < smallest.displacementMeters) smallest = { channel, displacementMeters: maximum };
    }
    context.diagnostic(JSON.stringify({ effectiveNativeControls: active.length, weakest: smallest }));
    assert.equal(originalGeometry(fixture.legacy), cached.legacy); assert.equal(originalGeometry(fixture.web), cached.web);
  } finally { runtime.dispose(); }
});

function bodyPoseSnapshot(runtime) {
  return new Map([...runtime.body.bones].map(([name, bone]) => [name, [bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]]));
}
