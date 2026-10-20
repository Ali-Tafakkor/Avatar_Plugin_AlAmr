import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PerspectiveCamera } from 'three';
import { createWebAvatarRuntime } from '../../../../آواتار/src/web-v2/runtime.mjs';
import { createMotionTestRuntime } from '../runtime.mjs';
import { loadMotionFixtures } from './model-fixtures.mjs';

const { web, legacy } = await loadMotionFixtures();
const motions = JSON.parse(await fs.readFile(new URL('../../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
const camera = new PerspectiveCamera(); camera.position.set(0, 1.5, 5);
function frame(state = 'idle', grounded = true, y = 0, verticalSpeed = 0, speed = 0, mode = 'grounded') {
  return { pose: { position: [0, y, 0], velocity: [0, verticalSpeed, -speed], yaw: 0, mode },
    locomotion: { state, grounded, verticalSpeed, horizontalSpeed: speed }, camera };
}
function advance(runtime, dt, value) { runtime.root.position.y = value.pose.position[1]; runtime.update(dt, value); }
function difference(a, b) {
  let angle = 0, position = 0, scale = 0;
  for (const [name, bone] of a.actor.bones) {
    const other = b.actor.bones.get(name);
    // Animation tracks store float32 quaternions; normalize for angle
    // measurement so identical non-unit samples do not report a false error.
    angle = Math.max(angle, bone.quaternion.clone().normalize().angleTo(other.quaternion.clone().normalize()));
    position = Math.max(position, bone.position.distanceTo(other.position));
    scale = Math.max(scale, bone.scale.distanceTo(other.scale));
  }
  return { angle, position, scale };
}

test('airborne pose retains the original V2 jump on all 73 bones, including return from run', async () => {
  const original = await createWebAvatarRuntime(web.gltf, motions);
  const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  try {
    let worstAngle = 0, worstPosition = 0;
    for (let i = 0; i < 18; i++) {
      const value = frame('run', true, 0, 0, 9); advance(original, 1 / 60, value); advance(candidate, 1 / 60, value);
    }
    for (let i = 0; i < 35; i++) {
      const t = (i + 1) / 60, vy = 5.6 - 18.8 * t, y = Math.max(0, 5.6 * t - 0.5 * 18.8 * t * t);
      const value = frame(vy > 0 ? 'jump' : 'fall', false, y, vy, 9);
      advance(original, 1 / 60, value); advance(candidate, 1 / 60, value);
      const d = difference(original, candidate); worstAngle = Math.max(worstAngle, d.angle); worstPosition = Math.max(worstPosition, d.position);
      assert.equal(candidate.getStatus().activeMotionSource, 'V2-original-jump');
      assert.ok(d.scale < 1e-9);
    }
    assert.ok(worstAngle < 1e-5, `jump angular difference ${worstAngle}rad`);
    assert.ok(worstPosition < 1e-7, `jump local translation difference ${worstPosition}m`);
    for (let i = 0; i < 36; i++) advance(candidate, 1 / 60, frame());
    assert.equal(candidate.getStatus().activeMotionSource, 'V1-original-tracks-retargeted');
    assert.equal(candidate.getStatus().jumpWeight, 0);
  } finally { original.dispose(); candidate.dispose(); }
});

test('V1 flight is not replaced by the V2 jump branch', async () => {
  const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  try {
    for (let i = 0; i < 30; i++) advance(candidate, 1 / 60, frame('fly', false, 2, 0, 7, 'flying'));
    const status = candidate.getStatus();
    assert.equal(status.clip, 'Fly'); assert.equal(status.jumpWeight, 0);
    assert.equal(status.activeMotionSource, 'V1-original-tracks-retargeted');
  } finally { candidate.dispose(); }
});

test('all six V2 facial emotions and blink remain active during exact paused V1 HandRaise sampling', async () => {
  const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  const independent = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  try {
    candidate.previewClip('HandRaise'); candidate.setPlayback({ paused: true }); candidate.seekClip(1.5);
    const signatures = [];
    for (const emotion of ['neutral', 'smile', 'laugh', 'sad', 'angry', 'surprise']) {
      candidate.setEmotion(emotion);
      for (let i = 0; i < 70; i++) advance(candidate, 1 / 60, frame());
      const status = candidate.getStatus();
      assert.equal(status.emotion, emotion); assert.equal(status.time, 1.5); assert.equal(status.morphCount, 66);
      assert.deepEqual(status.missingShapes, []);
      signatures.push(JSON.stringify(Object.entries(status.weights).filter(([name]) => !/Blink|Look/.test(name)).map(([n, v]) => [n, Math.round(v * 1000)])));
    }
    assert.equal(new Set(signatures).size, 6);
    candidate.blink(); advance(candidate, 0.07, frame());
    assert.ok(candidate.getStatus().weights.eyeBlinkLeft > 0.95);
    assert.equal(independent.expressions.name, 'smile');
    for (const [name, bone] of candidate.actor.bones) assert.notEqual(bone, independent.actor.bones.get(name));
    assert.notEqual(candidate.actor.meshes[0].geometry, independent.actor.meshes[0].geometry);
  } finally { candidate.dispose(); independent.dispose(); }
});

test('seated one-shot holds its true endpoint; reset clears preview and the jump branch', async () => {
  const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  try {
    candidate.previewClip('StandToSit'); candidate.setPlayback({ paused: true });
    const duration = candidate.getStatus().duration; candidate.seekClip(duration);
    advance(candidate, 1 / 60, frame());
    const hip = candidate.actor.bones.get('hips').position.clone();
    for (let i = 0; i < 4; i++) advance(candidate, 0.1, frame());
    assert.equal(candidate.getStatus().time, duration);
    assert.ok(hip.distanceTo(candidate.actor.bones.get('hips').position) < 1e-8);
    candidate.reset(); advance(candidate, 1 / 60, frame());
    assert.equal(candidate.getStatus().mode, 'locomotion'); assert.equal(candidate.getStatus().jumpWeight, 0);
    assert.ok(candidate.getStatus().feet.left.soleMinY >= -1e-6);
    assert.ok(candidate.getStatus().feet.right.soleMinY >= -1e-6);
    assert.throws(() => candidate.previewClip('Jump'), /phase1_clip_unavailable/);
  } finally { candidate.dispose(); }
});

test('grounding removes sole penetration and preserves body rotations outside explicit shoe and finger overrides', async () => {
  const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  try {
    for (const { name, duration } of candidate.getStatus().clips) {
      if (name === 'Fly') continue;
      candidate.previewClip(name); candidate.setPlayback({ paused: true });
      for (const phase of [0, 0.25, 0.5, 0.75, 0.9999]) {
        candidate.mapped.sample(name, phase * duration);
        const rawRotations = new Map([...candidate.actor.bones].map(([boneName, b]) => [boneName, b.quaternion.clone().normalize()]));
        candidate.seekClip(phase * duration); advance(candidate, 1 / 60, frame());
        const status = candidate.getStatus();
        assert.ok(status.feet.left.soleMinY >= -1e-6, `${name} left sole`);
        assert.ok(status.feet.right.soleMinY >= -1e-6, `${name} right sole`);
        for (const [boneName, b] of candidate.actor.bones) {
          // Owner-requested posture corrections explicitly own foot/toe and
          // finger rotations. Raw V1 retarget fidelity remains separately tested.
          if (/^(left|right)(foot|toebase)$/.test(boneName) || /hand(?:thumb|index|middle|ring|pinky)[1-4]$/.test(boneName)) continue;
          assert.ok(b.quaternion.clone().normalize().angleTo(rawRotations.get(boneName)) < 1e-7, `${name} grounding changed ${boneName}`);
        }
      }
    }
  } finally { candidate.dispose(); }
});

test('integrated standing plants each heel and toe independently throughout the idle clip', async () => {
  const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
  try {
    candidate.root.rotation.y = 1.1;
    candidate.previewClip('Stand'); candidate.setPlayback({ paused: true });
    const duration = candidate.getStatus().duration;
    for (let index = 0; index <= 40; index++) {
      candidate.seekClip(duration * index / 41); advance(candidate, 1 / 60, frame());
      const status = candidate.getStatus();
      assert.equal(status.footContact.active, true);
      assert.equal(status.relaxedHands.applied, true);
      assert.equal(status.relaxedHands.fingerBones, 40);
      for (const side of ['left', 'right']) {
        assert.ok(Math.abs(status.feet[side].heelY) < 0.002, `${side} heel at ${index}`);
        assert.ok(Math.abs(status.feet[side].toeY) < 0.002, `${side} toe at ${index}`);
        assert.equal(status.footContact.feet[side].limited, false);
      }
    }
    candidate.previewClip('Walk'); candidate.seekClip(0.3); advance(candidate, 1 / 60, frame());
    assert.equal(candidate.getStatus().footContact.active, false, 'walk retains source heel/toe roll');
    assert.equal(candidate.getStatus().relaxedHands.applied, true);
    candidate.previewClip('HandRaise'); candidate.seekClip(1.4); advance(candidate, 1 / 60, frame());
    assert.equal(candidate.getStatus().relaxedHands.applied, false, 'raised-hand gesture remains source-owned');
  } finally { candidate.dispose(); }
});
