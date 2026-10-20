import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { createActorInstance } from '../../../../آواتار/src/web-v2/actor.mjs';
import { retargetV1Clips } from '../retarget.mjs';
import { createFootContact } from '../foot-contact.mjs';
import { loadMotionFixtures } from './model-fixtures.mjs';

const { legacy, web } = await loadMotionFixtures();
const frame = (state = 'idle', grounded = true, mode = 'grounded') => ({
  pose: { position: [0, 0, 0], velocity: [0, 0, 0], yaw: 0, mode },
  locomotion: { state, grounded, horizontalSpeed: 0, verticalSpeed: 0 },
});
const transforms = actor => new Map([...actor.bones].map(([name, bone]) => [name,
  { p: bone.position.toArray(), q: bone.quaternion.toArray(), s: bone.scale.toArray() }]));

function setup(transformed = false) {
  const actor = createActorInstance(web.gltf), host = new Group();
  if (transformed) { host.position.set(8, 3.2, -7); host.rotation.y = 1.8; }
  host.add(actor.root); host.updateMatrixWorld(true);
  const mapped = retargetV1Clips(actor, legacy.gltf);
  const contact = createFootContact(actor, { groundAt: () => host.position.y });
  return { actor, host, mapped, contact, dispose() { mapped.dispose(); actor.dispose(); } };
}

test('real heels and toes are both within 2mm of the floor over the full Stand clip under identity and transformed hosts', () => {
  for (const transformed of [false, true]) {
    const fixture = setup(transformed), { actor, mapped, contact, host } = fixture;
    try {
      const duration = mapped.clips.get('Stand').duration;
      for (let i = 0; i <= 40; i++) {
        mapped.sample('Stand', duration * i / 40);
        const rootPosition = actor.root.position.toArray(), rootRotation = actor.root.quaternion.toArray();
        const before = transforms(actor);
        const status = contact.apply({ frame: frame(), clip: 'Stand', delta: 1 / 60 });
        assert.equal(status.active, true);
        for (const side of ['left', 'right']) {
          const foot = status.feet[side];
          assert.equal(foot.limited, false, side + ' correction must fit its explicit limit');
          assert.ok(Math.abs(foot.after.heelY - host.position.y) < 0.002, side + ' heel residual ' + foot.after.heelResidual);
          assert.ok(Math.abs(foot.after.toeY - host.position.y) < 0.002, side + ' toe residual ' + foot.after.toeResidual);
          assert.ok(Math.abs(foot.after.pitchDegrees) < 0.001);
          assert.ok(Math.abs(foot.after.rollDegrees) < 0.001);
        }
        assert.deepEqual(actor.root.position.toArray(), rootPosition);
        assert.deepEqual(actor.root.quaternion.toArray(), rootRotation);
        for (const [name, original] of before) {
          if (/foot$|toebase$/.test(name)) continue;
          assert.deepEqual(transforms(actor).get(name), original, 'unrelated joint changed: ' + name);
        }
      }
    } finally { fixture.dispose(); }
  }
});

test('static seated and hand-raise poses plant both shoe ends without cumulative ankle drift', () => {
  const fixture = setup(), { mapped, contact, actor } = fixture;
  try {
    for (const clip of ['HandRaise', 'Sitting', 'StandToSit', 'SittoStand']) {
      for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
        mapped.sample(clip, mapped.clips.get(clip).duration * phase);
        const status = contact.apply({ frame: frame(), clip, delta: 0, preview: true });
        for (const side of ['left', 'right']) {
          assert.equal(status.feet[side].limited, false, clip + ' ' + side + ' translation cap');
          assert.ok(Math.abs(status.feet[side].after.heelResidual) < 0.002, clip + ' ' + side + ' heel');
          assert.ok(Math.abs(status.feet[side].after.toeResidual) < 0.002, clip + ' ' + side + ' toe');
        }
        const planted = transforms(actor);
        contact.apply({ frame: frame(), clip, delta: 0, preview: true });
        for (const side of ['left', 'right']) {
          const before = planted.get(side + 'foot'), after = transforms(actor).get(side + 'foot');
          for (let i = 0; i < 3; i++) assert.ok(Math.abs(before.p[i] - after.p[i]) < 1e-7, clip + ' repeated contact drift');
        }
      }
    }
  } finally { fixture.dispose(); }
});

test('intentional Walk/Run/Fly and every V2 air/landing branch are untouched', () => {
  const fixture = setup(), { mapped, contact, actor } = fixture;
  try {
    for (const clip of ['Walk', 'Run', 'Fly']) {
      mapped.sample(clip, mapped.clips.get(clip).duration * 0.4);
      const before = transforms(actor);
      assert.equal(contact.apply({ frame: frame(), clip, delta: 1 / 60, preview: true }).active, false);
      assert.deepEqual(transforms(actor), before, clip + ' pose must remain exact');
    }
    for (const [state, grounded, mode] of [['jump', false, 'grounded'], ['fall', false, 'grounded'], ['land', true, 'grounded'], ['fly', false, 'flying']]) {
      mapped.sample('Stand', 0.4);
      const before = transforms(actor);
      assert.equal(contact.apply({ frame: frame(state, grounded, mode), clip: 'Stand', delta: 1 / 60 }).active, false);
      assert.deepEqual(transforms(actor), before, state + ' pose must remain exact');
    }
  } finally { fixture.dispose(); }
});
