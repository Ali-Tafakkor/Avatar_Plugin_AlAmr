import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createHybridRuntime } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import { loadHybridAssets } from '../../آواتار/tests/load-hybrid-assets.mjs';
import { stabilizeHandContact } from '../../avatar-olive-man/hand-contact.mjs';

const sides = ['left', 'right'];
const frame = {
  pose: { position: [0, 0, 0], velocity: [0, 0, 0], yaw: 0, mode: 'grounded' },
  locomotion: { state: 'idle', grounded: true, horizontalSpeed: 0, verticalSpeed: 0 },
  camera: new PerspectiveCamera(),
};

function wristTrace(runtime, { clip, paused, fps, time = 0, warmup = .3 }) {
  runtime.previewClip(clip);
  runtime.setPlayback({ paused, timeScale: 1 });
  if (clip) runtime.seekClip(time);
  for (let i = 0; i < fps * warmup; i++) runtime.update(1 / fps, frame);

  const traces = Object.fromEntries(sides.map(side => [side, {
    bone: runtime.body.bones.get(side + 'hand'),
    previous: new Vector3(), origin: new Vector3(), current: new Vector3(),
    maxStep: 0, travel: 0,
  }]));
  for (const trace of Object.values(traces)) trace.bone.getWorldPosition(trace.origin);
  for (const trace of Object.values(traces)) trace.previous.copy(trace.origin);
  for (let i = 0; i < fps * .7; i++) {
    runtime.update(1 / fps, frame);
    for (const trace of Object.values(traces)) {
      trace.bone.getWorldPosition(trace.current);
      trace.maxStep = Math.max(trace.maxStep, trace.current.distanceTo(trace.previous));
      trace.travel = Math.max(trace.travel, trace.current.distanceTo(trace.origin));
      trace.previous.copy(trace.current);
    }
  }
  return Object.fromEntries(sides.map(side => [side, {
    maxStep: traces[side].maxStep, travel: traces[side].travel,
  }]));
}

test('Olive man holds both wrists steadily and retains the real hand–body constraint', async t => {
  const { legacy, web, motions } = await loadHybridAssets();
  const runtime = await createHybridRuntime(legacy, web, motions);
  t.after(() => runtime.dispose());
  const contact = runtime.handContact;
  const still = { clip: 'Stand', paused: true, fps: 120 };
  const transition = { clip: 'StandToSit', paused: false, fps: 60 };
  const before = wristTrace(runtime, still);
  assert.ok(before.right.maxStep > .001, 'the production rig must reproduce the visible idle jitter');

  const beforeTransition = wristTrace(runtime, transition);
  const originalSolve = contact.solve;
  const originalStaticContact = runtime.body.applyStaticContact;
  const restore = stabilizeHandContact(runtime);
  try {
    for (const pose of [still, { ...still, fps: 60 }, { clip: 'Sitting', time: .44, paused: true, fps: 60 }]) {
      const after = wristTrace(runtime, pose);
      assert.ok(after.right.maxStep < .00001);
      assert.ok(after.left.maxStep < .00001);
      assert.ok(sides.every(side => contact.measure(true)[side].penetration < .004));
      for (const side of sides) {
        const wrist = runtime.body.bones.get(side + 'hand').getWorldPosition(new Vector3());
        const hand = runtime.hands.hands[side].mesh.getWorldPosition(new Vector3());
        assert.ok(wrist.distanceTo(hand) < 1e-7);
      }
      t.diagnostic(JSON.stringify({ pose, beforeStandMm: before.right.maxStep * 1000,
        rightWristStepMm: after.right.maxStep * 1000, leftWristStepMm: after.left.maxStep * 1000 }));
    }
    const idle = wristTrace(runtime, { clip: null, paused: false, fps: 60, warmup: .5 });
    assert.ok(idle.right.maxStep < .0002);
    assert.ok(contact.getStatus().hands.right.angle < .023, 'the seated correction must release on return to idle');
    const afterTransition = wristTrace(runtime, transition);
    for (const side of sides) {
      assert.ok(Math.abs(afterTransition[side].maxStep - beforeTransition[side].maxStep) < .00001);
      assert.ok(Math.abs(afterTransition[side].travel - beforeTransition[side].travel) < .00001);
    }
    const walk = wristTrace(runtime, { clip: 'Walk', paused: false, fps: 60 });
    assert.ok(walk.right.travel > .05 && walk.left.travel > .05);
  } finally {
    restore();
  }
  assert.equal(contact.solve, originalSolve);
  assert.equal(runtime.body.applyStaticContact, originalStaticContact);
});
