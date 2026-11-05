import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Vector3 } from 'three';
import { createHybridRuntime } from '../dist/hybrid/runtime.mjs';
import { loadHybridAssets } from './load-hybrid-assets.mjs';

function sourceFingerprint(fixture) {
  const hash = createHash('sha256');
  for (const gltf of [fixture.legacy, fixture.web]) gltf.scene.traverse(node => {
    if (node.isBone) hash.update(JSON.stringify([node.name, ...node.position, ...node.quaternion, ...node.scale]));
    if (!node.isMesh) return;
    for (const attribute of [...Object.values(node.geometry.attributes), ...Object.values(node.geometry.morphAttributes).flat(),
      ...(node.geometry.index ? [node.geometry.index] : [])]) {
      hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
  });
  return hash.digest('hex');
}

test('built Hybrid writes speech into actual native morphs and restores its expression baseline', async () => {
  const fixture = await loadHybridAssets();
  const originalFingerprint = sourceFingerprint(fixture);
  const runtime = await createHybridRuntime(fixture.legacy, fixture.web, fixture.motions);
  const camera = new PerspectiveCamera(); camera.position.set(0, 1.6, 3);
  const frame = { pose: { position: [0, 0, 0], velocity: [0, 0, 0], yaw: 0, mode: 'grounded' },
    locomotion: { state: 'idle', grounded: true, horizontalSpeed: 0, verticalSpeed: 0 }, camera };
  const advance = () => { for (let i = 0; i < 30; i++) runtime.update(1 / 60, frame); };
  try {
    runtime.setFaceOptions({ blinkEnabled: false, gazeEnabled: false, microEnabled: false });
    runtime.setEmotion('neutral'); runtime.setManual('brows', 0.5); advance();
    const jaw = runtime.face.bindings.find(binding => binding.normalized === 'jawopen' && binding.node.name === 'AvatarHead');
    assert.ok(jaw, 'native head must expose the verified jaw target');
    const delta = jaw.node.geometry.morphAttributes.position[jaw.index];
    let vertex = 0, largest = 0;
    for (let i = 0; i < delta.count; i++) {
      const distance = Math.hypot(delta.getX(i), delta.getY(i), delta.getZ(i));
      if (distance > largest) { vertex = i; largest = distance; }
    }
    assert.ok(largest > 0, 'the bound target must contain real deformation');
    const before = jaw.node.getVertexPosition(vertex, new Vector3());
    runtime.setSpeechFrame({ jawOpen: 0.19, mouthPucker: 0.13, eyeBlinkLeft: 1, tongueOut: 1 }); advance();
    const status = runtime.getStatus();
    assert.ok(status.weights.jawOpen > 0.5 && status.weights.jawOpen <= 0.58);
    assert.equal(jaw.node.morphTargetInfluences[jaw.index], status.weights.jawOpen);
    assert.ok(status.weights.browInnerUp > 0.49, 'manual brow state survives speech');
    assert.equal(status.weights.eyeBlinkLeft, 0, 'speech eye predictions do not seize blink');
    assert.equal(Object.hasOwn(status.weights, 'tongueOut'), false);
    assert.ok(jaw.node.getVertexPosition(vertex, new Vector3()).distanceTo(before) > 0.0001,
      'the real skinned head surface must move, not only a diagnostics value');
    runtime.clearSpeech(); advance();
    assert.equal(jaw.node.morphTargetInfluences[jaw.index], 0);
    assert.equal(runtime.getStatus().speech.active, false);
    assert.ok(runtime.getStatus().weights.browInnerUp > 0.49);
  } finally { runtime.dispose(); }
  assert.equal(sourceFingerprint(fixture), originalFingerprint, 'cached binary-derived source geometry/rig must remain unchanged');
});

test('sustained speech holds the native jaw steady while live blink and mood motion continue', async () => {
  const fixture = await loadHybridAssets();
  const runtime = await createHybridRuntime(fixture.legacy, fixture.web, fixture.motions);
  const camera = new PerspectiveCamera(); camera.position.set(0, 1.6, 3);
  const frame = { pose: { position: [0, 0, 0], velocity: [0, 0, 0], yaw: 0, mode: 'grounded' },
    locomotion: { state: 'idle', grounded: true, horizontalSpeed: 0, verticalSpeed: 0 }, camera };
  const heldSpeech = { jawOpen: 0.16, mouthClose: 0.02, mouthFunnel: 0.04, mouthPucker: 0.03 };
  try {
    runtime.setFaceOptions({ blinkEnabled: true, gazeEnabled: true, microEnabled: true });
    const jaw = runtime.face.bindings.find(binding => binding.normalized === 'jawopen' && binding.node.name === 'AvatarHead');
    assert.ok(jaw, 'the regression must exercise the actual native head target');
    assert.ok(jaw.node.geometry.morphAttributes.position[jaw.index].array.some(value => value !== 0),
      'the jaw target must contain real mesh deformation');
    let referenceJaw;
    for (const emotion of ['neutral', 'laugh', 'smile']) {
      runtime.setEmotion(emotion);
      const values = [];
      let sawBlink = false;
      // A held frame stream at 30Hz with a 60Hz renderer must not acquire the
      // preset laugh rhythm or a fallback mouth loop, even during actual blinks.
      for (let tick = 0; tick < 360; tick++) {
        if (tick % 2 === 0) runtime.setSpeechFrame(heldSpeech, { speaking: true });
        runtime.update(1 / 60, frame);
        const status = runtime.getStatus();
        sawBlink ||= status.weights.eyeBlinkLeft > 0.95;
        assert.equal(jaw.node.morphTargetInfluences[jaw.index], status.weights.jawOpen,
          `${emotion}: another animation must not overwrite the composed native jaw`);
        if (tick >= 120) values.push(jaw.node.morphTargetInfluences[jaw.index]);
      }
      assert.ok(sawBlink, `${emotion}: blinking must remain active during the held vowel`);
      assert.ok(runtime.expressions.microEnabled, `${emotion}: micro motion must remain enabled`);
      const minimum = Math.min(...values), maximum = Math.max(...values);
      assert.ok(minimum > 0.4, `${emotion}: the held vowel must keep the native jaw open`);
      assert.ok(maximum - minimum < 1e-7,
        `${emotion}: sustained speech acquired jaw oscillation (${minimum}..${maximum})`);
      if (referenceJaw !== undefined) assert.ok(Math.abs(minimum - referenceJaw) < 1e-7,
        `${emotion}: mood motion must not change held speech articulation`);
      referenceJaw = minimum;
    }
  } finally { runtime.dispose(); }
});
