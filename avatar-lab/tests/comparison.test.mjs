import test from 'node:test';
import assert from 'node:assert/strict';
import { stepPlayerMovement } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { createComparisonSession, MOVEMENT_PROFILES, START_POSITIONS } from '../src/comparison.mjs';

test('switching releases held controls and preserves both independent world locations', () => {
  const session = createComparisonSession(), old = session.controllers.v1, web = session.controllers.v2;
  web.teleport([6, 0, -4], 0.7);
  web.setAction('forward', true); web.setAction('sprint', true);
  const oldPosition = [...old.getPoseSnapshot().position], webPosition = [...web.getPoseSnapshot().position];
  session.select('v1');
  assert.equal(session.controller, old);
  assert.deepEqual(old.getPoseSnapshot().position, oldPosition);
  assert.deepEqual(web.getPoseSnapshot().position, webPosition);
  assert.equal(Object.values(web.getInputSnapshot().actions).some(Boolean), false);
  old.setAction('jump', true); session.toggle();
  assert.equal(session.controller, web);
  assert.equal(Object.values(old.getInputSnapshot().actions).some(Boolean), false);
  assert.deepEqual(web.getPoseSnapshot().position, webPosition);
});

test('switching during a jump or flight parks the outgoing avatar on the shared ground', () => {
  const session = createComparisonSession(), web = session.controllers.v2;
  web.setPose({ ...web.getPoseSnapshot(), position: [2, 3, -8], velocity: [1, 4, -2], mode: 'flying' });
  session.select('v1');
  const pose = web.getPoseSnapshot();
  assert.deepEqual(pose.position, [2, 0, -8]);
  assert.deepEqual(pose.velocity, [0, 0, 0]); assert.equal(pose.mode, 'grounded');
});

test('only the chosen actor advances with its own movement profile', () => {
  const navigation = { sampleGround: point => ({ position: [point[0], 0, point[2]] }) };
  const intent = { forward: true, backward: false, left: false, right: false, sprint: true,
    ascend: false, descend: false, jumpRequested: false, toggleFlightRequested: false, cameraYaw: 0 };
  for (const id of ['v1', 'v2']) {
    const session = createComparisonSession(); session.select(id);
    const partner = session.controllers[id === 'v1' ? 'v2' : 'v1'];
    const partnerBefore = partner.getPoseSnapshot();
    for (let frame = 0; frame < 180; frame++) session.controller.setPose(stepPlayerMovement({
      pose: session.controller.getPoseSnapshot(), intent, navigation, deltaSeconds: 1 / 60, config: MOVEMENT_PROFILES[id],
    }));
    const pose = session.controller.getPoseSnapshot();
    assert.ok(pose.position[2] < -5);
    assert.ok(Math.abs(Math.hypot(pose.velocity[0], pose.velocity[2]) - MOVEMENT_PROFILES[id].sprintSpeed) < 0.01);
    assert.equal(partner.getPoseSnapshot(), partnerBefore, 'inactive actor must not receive movement');
  }
});

test('reset restores the side-by-side layout without changing the selected avatar', () => {
  const session = createComparisonSession(); session.select('v1');
  session.controllers.v1.teleport([-4, 0, -6], 1); session.controllers.v2.teleport([8, 0, 5], 2);
  session.controller.setAction('forward', true); session.reset();
  assert.equal(session.active, 'v1');
  for (const id of ['v1', 'v2']) {
    assert.deepEqual(session.controllers[id].getPoseSnapshot().position, START_POSITIONS[id]);
    assert.equal(Object.values(session.controllers[id].getInputSnapshot().actions).some(Boolean), false);
  }
});
