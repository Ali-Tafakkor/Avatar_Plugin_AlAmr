import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { ExpressionState, EMOTIONS } from '../../../../آواتار/src/web-v2/expressions.mjs';
import { createAvatar03Instance } from '../../../../آواتار/dist/model.js';
import { Avatar03Animator } from '../../../../آواتار/dist/motion.js';
import { createHybridRuntime } from '../runtime.mjs';
import { loadMotionFixtures } from '../../v1-motion/tests/model-fixtures.mjs';
import { capturePose, compareSegmentDirections, readBones } from '../../v1-motion/tests/pose-metrics.mjs';

// Active facade composition tests. The earlier face-transfer/eye-rig suites
// remain historical evidence for the abandoned transferred-V1-face path.
const { legacy, web } = await loadMotionFixtures();
function sourceFingerprint(gltf) {
  const hash = createHash('sha256'), geometries = new Set();
  gltf.scene.traverse(node => {
    if (node.isBone) hash.update(JSON.stringify([node.name, ...node.position, ...node.quaternion, ...node.scale]));
    if (!node.isMesh) return;
    hash.update(JSON.stringify((Array.isArray(node.material) ? node.material : [node.material])
      .map(material => [material.uuid, material.version, material.transparent, material.depthWrite, material.alphaTest])));
    const geometry = node.geometry; if (geometries.has(geometry)) return; geometries.add(geometry);
    const attributes = [...Object.entries(geometry.attributes),
      ...Object.entries(geometry.morphAttributes).flatMap(([name, values]) => values.map((attribute, i) => [name + '-morph-' + i, attribute]))];
    if (geometry.index) attributes.push(['indices', geometry.index]);
    for (const [name, attribute] of attributes) {
      hash.update(name); hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
  });
  return hash.digest('hex');
}
const sourceBefore = { legacy: sourceFingerprint(legacy.gltf), web: sourceFingerprint(web.gltf) };
const motions = JSON.parse(await fs.readFile(new URL('../../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
const first = await createHybridRuntime(legacy.gltf, web.gltf, motions);
const second = await createHybridRuntime(legacy.gltf, web.gltf, motions);
const host = new Group(); host.add(first.root);
const camera = new PerspectiveCamera(); camera.position.set(0, 1.6, 5);
const frame = (state = 'idle', grounded = true, y = 0, vy = 0, speed = 0, mode = 'grounded') => ({
  pose: { position: [0, y, 0], velocity: [0, vy, -speed], yaw: 0, mode },
  locomotion: { state, grounded, horizontalSpeed: speed, verticalSpeed: vy }, camera,
});
function advance(runtime, dt, value = frame()) {
  if (runtime === first) { host.position.y = value.pose.position[1]; host.updateMatrixWorld(true); }
  runtime.update(dt, value);
}
const bonesPose = bones => new Map([...bones].map(([name, bone]) => [name, {
  p: bone.position.toArray(), q: bone.quaternion.toArray(), s: bone.scale.toArray(),
}]));
function headBinding(runtime, normalized) {
  const matches = runtime.face.bindings.filter(binding => binding.normalized === normalized);
  const result = matches.find(binding => /AvatarHead/i.test(binding.node.name)) ?? matches[0];
  assert.ok(result, 'the mounted head must include ' + normalized);
  return result;
}
function assertAllFaceWeightsFinite(runtime) {
  for (const value of Object.values(runtime.getStatus().weights)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  for (const binding of runtime.face.bindings) {
    const value = binding.node.morphTargetInfluences[binding.index];
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
}
test.after(() => { first.dispose(); second.dispose(); });

test('the real ExpressionState preserves all six preset weight contracts while a V1 HandRaise is paused and scrubbed', () => {
  assert.ok(first.expressions instanceof ExpressionState);
  first.previewClip('HandRaise'); first.setPlayback({ paused: true }); first.seekClip(1.5);
  first.setIntensity(1); first.setFaceOptions({ blinkEnabled: false, gazeEnabled: false, microEnabled: false });
  advance(first, 1 / 60);
  const bodyBefore = bonesPose(first.body.bones);
  for (const emotion of ['neutral', 'smile', 'laugh', 'sad', 'angry', 'surprise']) {
    first.setEmotion(emotion);
    for (let i = 0; i < 90; i++) advance(first, 1 / 60);
    const status = first.getStatus();
    assert.equal(status.emotion, emotion); assert.equal(status.mode, 'preview'); assert.equal(status.time, 1.5);
    assert.equal(status.morphCount, first.face.shapes.size);
    assert.ok(status.morphCount > 0);
    // Controller values and real geometric bindings are separate assertions;
    // native-head coverage and effective deformation have their own suite.
    for (const [name, amount] of Object.entries(status.weights).filter(([name]) => /^(mouth|jaw|brow|nose|cheek)/.test(name))) {
      assert.ok(Math.abs(amount - (EMOTIONS[emotion].values[name] ?? 0)) < 0.002, emotion + ' ' + name + ': ' + amount);
    }
    assertAllFaceWeightsFinite(first);
    const after = bonesPose(first.body.bones);
    for (const [name, original] of bodyBefore) {
      if (/foot$|toebase$/.test(name)) continue; // Explicit static-contact owner.
      assert.deepEqual(after.get(name), original, emotion + ' rewrote body joint ' + name);
    }
  }
  first.seekClip(2.5); advance(first, 1 / 60); assert.equal(first.getStatus().time, 2.5);
  first.seekClip(0.25); advance(first, 1 / 60); assert.equal(first.getStatus().time, 0.25);
});

test('manual jaw and an explicit blink reach real visible morph bindings while native body playback stays paused', () => {
  first.setEmotion('neutral');
  for (let i = 0; i < 90; i++) advance(first, 1 / 60);
  const { node: mesh, index } = headBinding(first, 'jawopen');
  const attribute = mesh.geometry.morphAttributes.position[index];
  const base = mesh.geometry.attributes.position;
  let sample = 0, maximum = 0;
  for (let i = 0; i < attribute.count; i++) {
    const delta = new Vector3().fromBufferAttribute(attribute, i);
    if (!mesh.geometry.morphTargetsRelative) delta.sub(new Vector3().fromBufferAttribute(base, i));
    const magnitude = delta.lengthSq();
    if (magnitude > maximum) { maximum = magnitude; sample = i; }
  }
  first.body.refresh();
  const before = mesh.getVertexPosition(sample, new Vector3()).applyMatrix4(mesh.matrixWorld);
  first.setManual('jaw', 0.75);
  for (let i = 0; i < 90; i++) advance(first, 1 / 60);
  assert.ok(first.getStatus().weights.jawOpen > 0.749);
  const jawBindings = first.face.bindings.filter(binding => binding.normalized === 'jawopen');
  assert.ok(jawBindings.length > 0);
  for (const binding of jawBindings) assert.ok(binding.node.morphTargetInfluences[binding.index] > 0.749);
  first.body.refresh();
  const after = mesh.getVertexPosition(sample, new Vector3()).applyMatrix4(mesh.matrixWorld);
  assert.ok(after.distanceTo(before) > 0.001, 'jaw weights must move real visible geometry by more than 1mm');
  const bodyBefore = bonesPose(first.body.bones), time = first.getStatus().time;
  first.blink(); advance(first, 0.07);
  assert.ok(first.getStatus().weights.eyeBlinkLeft > 0.99);
  assert.ok(first.getStatus().weights.eyeBlinkRight > 0.97);
  for (const name of ['eyeblinkleft', 'eyeblinkright']) {
    const bindings = first.face.bindings.filter(binding => binding.normalized === name);
    assert.ok(bindings.length > 0);
    for (const binding of bindings) assert.ok(binding.node.morphTargetInfluences[binding.index] > 0.97);
  }
  assert.equal(first.getStatus().time, time); assert.deepEqual(bonesPose(first.body.bones), bodyBefore);
  assertAllFaceWeightsFinite(first);
});

test('facial expression and blink coexist with native V1 run and the mapped V2 jump without taking body ownership', () => {
  first.reset(); first.setPlayback({ paused: false, timeScale: 1 }); first.setEmotion('laugh');
  const reference = createAvatar03Instance(legacy.gltf, 1.78, 'scene'), native = new Avatar03Animator(reference.model, legacy.gltf.animations);
  const referenceBones = readBones(reference.root);
  try {
    for (let i = 0; i < 30; i++) {
      const value = frame('run', true, 0, 0, 9); advance(first, 1 / 60, value); native.setMotion(value.locomotion); native.update(1 / 60);
      if (i > 18) assert.deepEqual(bonesPose(first.body.bones), bonesPose(referenceBones), 'face altered native V1 Run');
    }
    let worst = 0, largestBlink = 0;
    for (let i = 0; i < 35; i++) {
      const time = (i + 1) / 60, vy = 5.6 - 18.8 * time, y = Math.max(0, 5.6 * time - 9.4 * time * time);
      if (i === 8) first.blink();
      advance(first, 1 / 60, frame(vy > 0 ? 'jump' : 'fall', false, y, vy, 9));
      assert.equal(first.getStatus().activeMotionSource, 'V2-jump-retargeted-to-V1');
      assert.equal(first.getStatus().staticContact.active, false);
      const comparison = compareSegmentDirections(capturePose(first.body.jumpDonor.actor), capturePose(first.actor));
      for (const segment of comparison.segments.filter(value => !/hand.*(?:thumb|index)|toeend/.test(value.name))) worst = Math.max(worst, segment.degrees);
      largestBlink = Math.max(largestBlink, first.getStatus().weights.eyeBlinkLeft);
      assert.ok(first.getStatus().weights.jawOpen > 0.1); assertAllFaceWeightsFinite(first);
    }
    assert.ok(worst < 0.001, 'visible hybrid jump orientation error ' + worst);
    assert.ok(largestBlink > 0.99, 'blink must remain active during the jump');
    for (let i = 0; i < 36; i++) advance(first, 1 / 60);
    assert.equal(first.getStatus().jumpWeight, 0); assert.equal(first.getStatus().activeMotionSource, 'V1-original-native-tracks');
  } finally { native.dispose(); reference.dispose(); }
});

test('two complete hybrids isolate skeletons, face arrays and materials and leave both cached sources unchanged', () => {
  assert.notEqual(first.root, second.root); assert.notEqual(first.face, second.face); assert.notEqual(first.expressions, second.expressions);
  for (const [name, bone] of first.body.bones) assert.notEqual(bone, second.body.bones.get(name));
  for (let i = 0; i < first.body.meshes.length; i++) {
    const one = first.body.meshes[i], two = second.body.meshes[i];
    assert.notEqual(one.geometry, two.geometry); assert.notEqual(one.material, two.material);
    assert.notEqual(one.geometry.attributes.position.array, two.geometry.attributes.position.array);
  }
  const one = headBinding(first, 'jawopen').node, two = headBinding(second, 'jawopen').node;
  assert.notEqual(one, two); assert.notEqual(one.geometry, two.geometry); assert.notEqual(one.material, two.material);
  for (const [name, index] of Object.entries(one.morphTargetDictionary)) {
    const other = two.morphTargetDictionary[name]; assert.notEqual(other, undefined);
    assert.notEqual(one.geometry.morphAttributes.position[index].array, two.geometry.morphAttributes.position[other].array);
  }
  assert.equal(second.expressions.name, 'neutral'); assert.deepEqual(second.getStatus().weights, {});
  assert.equal(sourceFingerprint(legacy.gltf), sourceBefore.legacy);
  assert.equal(sourceFingerprint(web.gltf), sourceBefore.web);
  first.dispose(); first.dispose();
  second.setEmotion('smile'); advance(second, 0.1);
  assert.ok(second.getStatus().weights.mouthSmileLeft > 0);
  assert.equal(second.getStatus().disposed, false); assertAllFaceWeightsFinite(second);
});
