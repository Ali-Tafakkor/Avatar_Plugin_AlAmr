import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { createActorInstance } from '../../../آواتار/src/web-v2/actor.mjs';
import { createRelaxedHands } from './relaxed-hands.mjs';
import { loadGeometryGlb } from './tests/model-fixtures.mjs';

const fixture = await loadGeometryGlb(new URL('../../../آواتار/assets-source/web-v2/avatar.glb', import.meta.url));
const actor = createActorInstance(fixture.gltf);
const snapshot = () => [...actor.bones].map(([name, bone]) => [name, ...bone.position, ...bone.quaternion, ...bone.scale]);
const original = snapshot(), layer = createRelaxedHands(actor);
test.after(() => actor.dispose());

function metrics(side) {
  actor.refresh();
  const hand = actor.bones.get(side + 'hand'), inverse = hand.getWorldQuaternion(new Quaternion()).invert(), origin = hand.getWorldPosition(new Vector3());
  const { forward, radial, palm } = layer.getStatus().calibration.find(item => item.side === side);
  const axes = [radial, forward, palm].map(value => new Vector3().fromArray(value));
  const result = {};
  for (const digit of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
    const chain = [1, 2, 3, 4].map(index => actor.bones.get(side + 'hand' + digit + index));
    const points = chain.map(bone => bone.getWorldPosition(new Vector3()).sub(origin).applyQuaternion(inverse));
    const directions = points.slice(0, 3).map((point, index) => points[index + 1].clone().sub(point));
    result[digit] = { tip: axes.map(axis => points[3].dot(axis)),
      curls: directions.map(direction => Math.asin(Math.max(-1, Math.min(1, direction.clone().normalize().dot(axes[2])))) * 180 / Math.PI),
      lengths: directions.map(direction => direction.length()), points };
  }
  return result;
}

test('calibration leaves the existing pose intact, including all 73 bone transforms', () => {
  assert.deepEqual(snapshot(), original);
  assert.equal(layer.getStatus().fingerBones, 40);
});

test('all five digits have finite bounded geometry, mild spread and progressive anatomical curl on both sides', () => {
  actor.restore(); const rest = { left: metrics('left'), right: metrics('right') };
  assert.equal(layer.apply({ clip: 'Stand' }).applied, true);
  const measured = { left: metrics('left'), right: metrics('right') };
  for (const side of ['left', 'right']) {
    const hand = measured[side];
    for (const [digit, value] of Object.entries(hand)) {
      assert.ok([...value.tip, ...value.curls, ...value.lengths].every(Number.isFinite), side + digit);
      assert.ok(value.curls[0] > 5 && value.curls[2] > value.curls[0] + 15, side + digit + ' curls into its own palm');
      assert.ok(value.tip[1] > 0.06 && value.tip[1] < 0.23, side + digit + ' bounded forward reach');
      value.lengths.forEach((length, index) => assert.ok(Math.abs(length - rest[side][digit].lengths[index]) < 1e-7, side + digit + ' no segment stretch'));
    }
    const fingers = ['index', 'middle', 'ring', 'pinky'];
    for (let index = 1; index < fingers.length; index++) {
      const previous = hand[fingers[index - 1]], current = hand[fingers[index]];
      assert.ok(previous.tip[0] > current.tip[0] + 0.004, side + ' adjacent tips retain ordered spacing');
    }
    assert.ok(hand.thumb.tip[0] > hand.index.tip[0], side + ' thumb remains beside the index');
  }
  for (const digit of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
    measured.left[digit].tip.forEach((value, axis) => assert.ok(Math.abs(value - measured.right[digit].tip[axis]) < 0.014, digit + ' mirrored anatomical pose'));
  }
  for (const [name, bone] of actor.bones) {
    assert.ok([...bone.quaternion].every(Number.isFinite));
    assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-6, name);
    if (!/hand(?:thumb|index|middle|ring|pinky)[1-4]$/.test(name)) assert.deepEqual(snapshot().find(value => value[0] === name), original.find(value => value[0] === name));
  }
});

test('gesture, airborne and explicit override bypass preserve every bone exactly; walking and running opt in', () => {
  for (const request of [{ clip: 'HandRaise' }, { clip: 'Stand', frame: { locomotion: { state: 'jump', grounded: false } } },
    { clip: 'Run', frame: { locomotion: { state: 'land', grounded: true } } }, { clip: 'Stand', weight: 0 }]) {
    const before = snapshot(); assert.equal(layer.apply(request).applied, false); assert.deepEqual(snapshot(), before);
  }
  for (const clip of ['Walk', 'Run']) { actor.restore(); assert.equal(layer.apply({ clip }).applied, true); }
  layer.setEnabled(false); const before = snapshot(); assert.equal(layer.apply({ clip: 'Stand' }).applied, false); assert.deepEqual(snapshot(), before);
});
