import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Group, Quaternion, Vector3 } from 'three';
import { EMOTIONS, FACE_GROUPS } from '../../../../آواتار/src/web-v2/expressions.mjs';
import { createHybridBodyRuntime, HYBRID_BODY_CLIPS } from '../body-runtime.mjs';
import { createSculptedFace } from '../sculpted-face.mjs';
import { loadMotionFixtures } from '../../v1-motion/tests/model-fixtures.mjs';

// Active native-V2-topology face tests. The retained face-transfer/eye-rig
// tests describe the previous prototype and are not this assembly's gate.
const NATIVE_MESHES = ['AvatarHead', 'AvatarEyelashes', 'AvatarLeftEyeball', 'AvatarRightEyeball', 'AvatarTeethLower', 'AvatarTeethUpper'];
const ACTIVE_CHANNELS = [...new Set([
  ...Object.values(EMOTIONS).flatMap(emotion => Object.keys(emotion.values)),
  ...Object.values(FACE_GROUPS).flat(), 'eyeBlinkLeft', 'eyeBlinkRight',
  ...['Up', 'Down', 'In', 'Out'].flatMap(direction => ['Left', 'Right'].map(side => 'eyeLook' + direction + side)),
])].sort();
const { legacy, web } = await loadMotionFixtures();
const motions = JSON.parse(await fs.readFile(new URL('../../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
function geometryFingerprint(gltf) {
  const hash = createHash('sha256');
  gltf.scene.traverse(node => {
    if (node.isBone) hash.update(JSON.stringify([node.name, ...node.position, ...node.quaternion, ...node.scale]));
    if (!node.isMesh) return;
    const geometry = node.geometry, attributes = [...Object.entries(geometry.attributes),
      ...Object.entries(geometry.morphAttributes).flatMap(([name, values]) => values.map((attribute, index) => [name + index, attribute]))];
    if (geometry.index) attributes.push(['index', geometry.index]);
    for (const [name, attribute] of attributes) {
      hash.update(name); hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
  });
  return hash.digest('hex');
}
const original = { legacy: geometryFingerprint(legacy.gltf), web: geometryFingerprint(web.gltf) };
const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions);
body.sample('Stand', 0);
const sculpted = await createSculptedFace(body, body.jumpDonor.actor, {});
const mounted = sculpted.mounted;
const sourceMeshes = new Map(body.jumpDonor.actor.meshes.map(mesh => [mesh.name, mesh]));
const host = new Group(); host.position.set(8, 3.2, -7); host.rotation.y = 1.8; host.add(body.root);
host.updateMatrixWorld(true); sculpted.update(); mounted.refresh();
test.after(() => { sculpted.dispose(); body.dispose(); });

function descendantOf(node, ancestor) {
  for (let item = node; item; item = item.parent) if (item === ancestor) return true;
  return false;
}
function visiblyAttached(node) {
  for (let item = node; item; item = item.parent) {
    if (!item.visible) return false;
    if (item === body.root) return true;
  }
  return false;
}
function usedVertices(mesh) {
  return mesh.geometry.index ? [...new Set(mesh.geometry.index.array)]
    : Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => index);
}
function worldSamples(meshes) {
  return new Map(meshes.map(mesh => [mesh, new Map(usedVertices(mesh).map(index =>
    [index, mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld)]))]));
}
function maximumMovement(meshes, before) {
  let maximum = 0;
  for (const mesh of meshes) for (const [index, point] of before.get(mesh)) {
    maximum = Math.max(maximum, mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(point));
  }
  return maximum;
}

test('the mounted native assembly owns six registered skin meshes, all 66 source channels and its complete independent skeleton', () => {
  assert.deepEqual(mounted.meshes.map(mesh => mesh.name).sort(), [...NATIVE_MESHES].sort());
  const expectedShapes = Object.keys(sourceMeshes.get('AvatarHead').morphTargetDictionary).sort();
  assert.equal(expectedShapes.length, 66); assert.deepEqual([...sculpted.face.shapes].sort(), expectedShapes);
  assert.deepEqual(sculpted.face.missing, []);
  assert.equal(mounted.bones.size, body.jumpDonor.actor.bones.size);
  assert.equal(mounted.bones.size, 73);
  const v1Bones = new Set(body.bones.values());
  for (const [name, bone] of mounted.bones) {
    assert.notEqual(bone, body.jumpDonor.actor.bones.get(name));
    assert.equal(bone.userData.hybridFaceBone, true); assert.ok(!v1Bones.has(bone));
    assert.ok(descendantOf(bone, mounted.model));
  }
  for (const mesh of mounted.meshes) {
    const source = sourceMeshes.get(mesh.name);
    assert.ok(visiblyAttached(mesh), mesh.name + ' is not part of the rendered hybrid');
    assert.notEqual(mesh.geometry, source.geometry); assert.notEqual(mesh.material, source.material);
    assert.notEqual(mesh.skeleton, source.skeleton);
    assert.deepEqual(mesh.geometry.attributes.skinIndex.array, source.geometry.attributes.skinIndex.array);
    assert.deepEqual(mesh.geometry.attributes.skinWeight.array, source.geometry.attributes.skinWeight.array);
    assert.deepEqual(mesh.geometry.attributes.uv.array, source.geometry.attributes.uv.array);
    assert.deepEqual(Object.keys(mesh.morphTargetDictionary ?? {}), Object.keys(source.morphTargetDictionary ?? {}));
    assert.ok(mesh.skeleton.bones.every(bone => bone.userData.hybridFaceBone));
    for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), mesh.name + ' has malformed ' + name);
      if (source.geometry.attributes[name]) {
        assert.notEqual(attribute.array, source.geometry.attributes[name].array, mesh.name + ' shares source ' + name);
      }
    }
    for (const [name, attributes] of Object.entries(mesh.geometry.morphAttributes)) {
      for (let index = 0; index < attributes.length; index++) {
        assert.ok(attributes[index].array.every(Number.isFinite), mesh.name + ' has malformed morph geometry');
        assert.notEqual(attributes[index].array, source.geometry.morphAttributes[name][index].array,
          mesh.name + ' shares source morph ' + name + index);
      }
    }
  }
  assert.equal(geometryFingerprint(legacy.gltf), original.legacy);
  assert.equal(geometryFingerprint(web.gltf), original.web);
});

test('all 37 live expression, manual, blink and gaze channels deform referenced visible vertices', context => {
  assert.equal(ACTIVE_CHANNELS.length, 37);
  const face = sculpted.face, sourceFace = body.jumpDonor.actor.face;
  const visibleMeshes = [...new Set(face.bindings.map(binding => binding.node))];
  assert.ok(visibleMeshes.every(visiblyAttached));
  const nativeMeshes = NATIVE_MESHES.map(name => sourceMeshes.get(name));
  face.apply({}); sourceFace.apply({}); mounted.refresh(); body.jumpDonor.actor.refresh();
  const before = worldSamples(visibleMeshes), sourceBefore = worldSamples(nativeMeshes), measurements = [];
  try {
    for (const name of ACTIVE_CHANNELS) {
      face.apply({ [name]: 1 }); sourceFace.apply({ [name]: 1 });
      mounted.refresh(); body.jumpDonor.actor.refresh();
      const movement = maximumMovement(visibleMeshes, before), sourceMovement = maximumMovement(nativeMeshes, sourceBefore);
      assert.ok(sourceMovement > 1e-5, name + ' is unexpectedly ineffective in the actual source');
      // The unchanged native controls move at least 2.8mm in this real asset;
      // require a visible 1mm response and retain their physical amplitude to
      // within 25% loss / 50% expansion after the modest identity sculpt.
      assert.ok(movement > 0.001 && movement / sourceMovement > 0.75,
        name + ' lost effective native deformation: visible=' + movement + ' source=' + sourceMovement);
      assert.ok(movement / sourceMovement < 1.5, name + ' has a physical unit/scale error');
      measurements.push({ name, movement, sourceMovement, ratio: movement / sourceMovement });
    }
  } finally { face.apply({}); sourceFace.apply({}); }
  const smallest = measurements.reduce((a, b) => a.movement < b.movement ? a : b);
  const ratioRange = [Math.min(...measurements.map(item => item.ratio)), Math.max(...measurements.map(item => item.ratio))];
  context.diagnostic(JSON.stringify({ effectiveChannels: measurements.length, smallestWorldMovement: smallest, sourceRatioRange: ratioRange }));
});

test('the metric head attachment follows all native V1 clip samples under a rotated and translated host without rewriting body joints', () => {
  sculpted.face.apply({});
  body.sample('Stand', 0); sculpted.update(); mounted.refresh();
  const origin = mounted.root.getWorldPosition(new Vector3()), targetOrigin = mounted.targetHead.getWorldPosition(new Vector3());
  assert.ok(origin.distanceTo(targetOrigin) < 1e-7);
  const originalOffset = mounted.bones.get('head').getWorldPosition(new Vector3()).sub(targetOrigin)
    .applyQuaternion(mounted.targetHead.getWorldQuaternion(new Quaternion()).invert());
  let maximumOffsetError = 0, maximumScaleError = 0;
  for (const name of HYBRID_BODY_CLIPS) {
    const clip = body.clips.get(name);
    for (const time of [0, clip.duration * 0.37, clip.duration]) {
      body.sample(name, time);
      const pose = [...body.bones].map(([name, bone]) => [name, bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]);
      sculpted.update(); mounted.refresh();
      assert.deepEqual([...body.bones].map(([name, bone]) => [name, bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]), pose);
      const offset = mounted.bones.get('head').getWorldPosition(new Vector3()).sub(mounted.targetHead.getWorldPosition(new Vector3()))
        .applyQuaternion(mounted.targetHead.getWorldQuaternion(new Quaternion()).invert());
      maximumOffsetError = Math.max(maximumOffsetError, offset.distanceTo(originalOffset));
      const scale = mounted.root.getWorldScale(new Vector3());
      maximumScaleError = Math.max(maximumScaleError, Math.abs(scale.x - 1), Math.abs(scale.y - 1), Math.abs(scale.z - 1));
      for (const mesh of mounted.meshes) {
        assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
        assert.ok(visiblyAttached(mesh));
      }
    }
  }
  assert.ok(maximumOffsetError < 1e-5, 'head placement drifted from V1 head by ' + maximumOffsetError + 'm');
  assert.ok(maximumScaleError < 1e-5, 'V1 imported raw scale leaked into the native head: ' + maximumScaleError);
  assert.equal(geometryFingerprint(legacy.gltf), original.legacy);
  assert.equal(geometryFingerprint(web.gltf), original.web);
});

test('lower neck skin follows the moving V1 torso and neck while face skin retains its calibrated head pose', context => {
  sculpted.face.apply({}); body.sample('Stand', 0); sculpted.update(); mounted.refresh();
  const mesh = mounted.meshes.find(mesh => mesh.name === 'AvatarHead');
  const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
  const groups = [
    { name: 'lower-neck/torso', native: /^Spine2$/, anchor: body.bones.get('spine2'), points: [] },
    { name: 'neck', native: /^Neck(?:1|2)?$/, anchor: body.bones.get('neck'), points: [] },
    { name: 'face', native: /^Head$/, anchor: body.bones.get('head'), points: [] },
  ];
  const v1Head = body.bones.get('head'), inverseHead = v1Head.matrixWorld.clone().invert();
  for (const index of usedVertices(mesh)) {
    const world = mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld);
    for (const group of groups) {
      let weight = 0;
      for (let component = 0; component < 4; component++) {
        const bone = mesh.skeleton.bones[indices.getComponent(index, component)];
        if (group.native.test(bone.name)) weight += weights.getComponent(index, component);
      }
      // Use actual referenced skin vertices owned by one anatomical region;
      // mixed seams have a legitimate weighted response between its anchors.
      if (weight < 1 - 1e-6) continue;
      group.points.push({ index,
        anchorPoint: world.clone().applyMatrix4(group.anchor.matrixWorld.clone().invert()),
        headPoint: world.clone().applyMatrix4(inverseHead) });
    }
  }
  for (const group of groups) assert.ok(group.points.length >= 3, 'real asset has no independent ' + group.name + ' skin surface patch');
  const metrics = groups.map(group => ({ name: group.name, vertices: group.points.length, maximumAnchorError: 0, rigidHeadSeparation: 0 }));
  const localPose = bones => [...bones].map(([name, bone]) => [name, bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]);
  for (const name of ['Sitting', 'StandToSit', 'Run', 'HandRaise']) {
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      body.sample(name, body.clips.get(name).duration * fraction);
      const nativeBody = localPose(body.bones), donorBody = localPose(body.jumpDonor.actor.bones);
      sculpted.update(); mounted.refresh();
      assert.deepEqual(localPose(body.bones), nativeBody, name + ' neck sync rewrote V1 animation');
      assert.deepEqual(localPose(body.jumpDonor.actor.bones), donorBody, name + ' neck sync rewrote the V2 jump donor');
      for (let g = 0; g < groups.length; g++) {
        const group = groups[g], metric = metrics[g];
        for (const point of group.points) {
          const expected = point.anchorPoint.clone().applyMatrix4(group.anchor.matrixWorld);
          const actual = mesh.getVertexPosition(point.index, new Vector3()).applyMatrix4(mesh.matrixWorld);
          metric.maximumAnchorError = Math.max(metric.maximumAnchorError, actual.distanceTo(expected));
          const carriedOnlyByHead = point.headPoint.clone().applyMatrix4(v1Head.matrixWorld);
          metric.rigidHeadSeparation = Math.max(metric.rigidHeadSeparation, expected.distanceTo(carriedOnlyByHead));
        }
      }
    }
  }
  // These are independent world-space surface checks, not comparisons against
  // updatePose's intermediate matrices. The prior rigid-Head mount must fail:
  // the selected clips separate the real torso/neck anchors from Head by >1cm.
  assert.ok(metrics[0].rigidHeadSeparation > 0.01, 'chosen poses did not exercise the collar regression');
  assert.ok(metrics[1].rigidHeadSeparation > 0.005, 'chosen poses did not exercise independent neck motion');
  for (const metric of metrics) assert.ok(metric.maximumAnchorError < 0.00005,
    metric.name + ' surface drifted from its V1 attachment by ' + metric.maximumAnchorError + 'm');
  assert.equal(geometryFingerprint(legacy.gltf), original.legacy);
  assert.equal(geometryFingerprint(web.gltf), original.web);
  context.diagnostic(JSON.stringify({ dynamicNeck: metrics }));
});
