import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraRelative, angleDelta, damp, seededRandom } from '../src/math.mjs';
import { CharacterPhysics, CollisionWorld, SETTINGS } from '../src/physics.mjs';
import { ExpressionState, EMOTIONS, normalizeShape, FaceRig } from '../src/expressions.mjs';

const idle = { x: 0, z: 0, run: false };
const forward = { x: 0, z: 1, run: false };
function simulate(p, seconds, input = idle, yaw = Math.PI) { for (let i = 0; i < Math.round(seconds * 120); i++) p.update(1 / 120, input, yaw); }

test('Camera-relative forward points away from the camera', () => {
  const [x, z] = cameraRelative(0, 1, 0); assert.ok(Math.abs(x) < 1e-9); assert.equal(z, -1);
  const [x2, z2] = cameraRelative(0, 1, Math.PI); assert.ok(Math.abs(x2) < 1e-9); assert.ok(Math.abs(z2 - 1) < 1e-9);
});
test('Diagonal input never exceeds straight movement speed', () => { const v = cameraRelative(1, 1, 0.8); assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-10); });
test('Angle interpolation takes the shortest direction across ±π', () => { assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9); });
test('Exponential damping is independent of the number of time steps', () => {
  let a = 0; for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60);
  assert.ok(Math.abs(a - damp(0, 1, 5, 1)) < 1e-12);
});
test('Character settles at the defined walking speed', () => {
  const p = new CharacterPhysics(new CollisionWorld()); simulate(p, 2, forward);
  assert.ok(Math.abs(p.speed - SETTINGS.walkSpeed) < 0.001); assert.equal(p.state, 'walk'); assert.ok(p.z > 2.7); assert.ok(Math.abs(p.yaw) < 0.01);
});
test('Shift increases speed without changing direction', () => {
  const p = new CharacterPhysics(new CollisionWorld()); simulate(p, 2, { ...forward, run: true });
  assert.ok(Math.abs(p.speed - SETTINGS.runSpeed) < 0.001); assert.equal(p.state, 'run'); assert.ok(p.z > 7);
});
test('Releasing movement brakes to a full stop', () => {
  const p = new CharacterPhysics(new CollisionWorld()); simulate(p, 1, { ...forward, run: true }); simulate(p, 0.5);
  assert.ok(p.speed < 1e-6); assert.equal(p.state, 'idle');
});
test('One Space press produces anticipation, flight and one grounded landing', () => {
  const p = new CharacterPhysics(new CollisionWorld()); p.jump(); let peak = 0, anticipates = false, airborne = false;
  for (let i = 0; i < 180; i++) { p.update(1 / 120, idle, 0); peak = Math.max(peak, p.y); anticipates ||= p.state === 'anticipation'; airborne ||= !p.grounded; }
  assert.ok(anticipates && airborne); assert.ok(peak > 0.70 && peak < 0.90); assert.ok(p.grounded); assert.equal(p.y, 0); assert.equal(p.jumpCount, 1);
});
test('An airborne second press does not create a double-jump', () => {
  const p = new CharacterPhysics(new CollisionWorld()); p.jump(); simulate(p, 0.2); p.jump(); simulate(p, 1.4);
  assert.equal(p.jumpCount, 1); assert.ok(p.grounded);
});
test('Jump buffering works shortly before landing', () => {
  const p = new CharacterPhysics(new CollisionWorld()); p.y = 0.04; p.vy = -1; p.grounded = false; p.coyote = 0; p.jump(); simulate(p, 0.2);
  assert.equal(p.jumpCount, 1); assert.ok(p.y > 0);
});
test('A wall stops actual motion and animation speed', () => {
  const w = new CollisionWorld([{ minX: -2, maxX: 2, minZ: 1.5, maxZ: 2.5, top: 2 }]); const p = new CharacterPhysics(w); simulate(p, 3, forward);
  assert.ok(p.z <= 1.5 - SETTINGS.radius + 0.0001); assert.ok(p.speed < 0.001); assert.equal(p.state, 'idle');
});
test('The controller can slide along a wall instead of sticking', () => {
  const w = new CollisionWorld([{ minX: 1.5, maxX: 2.5, minZ: -6, maxZ: 6, top: 2 }]); const p = new CharacterPhysics(w);
  simulate(p, 3, { x: -1, z: 1, run: false }); assert.ok(p.x <= 1.5 - SETTINGS.radius + 0.001); assert.ok(p.z > 2.8);
});
test('A low step is walkable; a tall obstacle is not auto-climbed', () => {
  const p = new CharacterPhysics(new CollisionWorld([{ minX: -1, maxX: 1, minZ: 0.5, maxZ: 4, top: 0.16 }])); simulate(p, 1, forward); assert.equal(p.y, 0.16);
  const q = new CharacterPhysics(new CollisionWorld([{ minX: -1, maxX: 1, minZ: 0.5, maxZ: 4, top: 0.6 }])); simulate(q, 1, forward); assert.equal(q.y, 0); assert.ok(q.z < 0.5);
});
test('A moving jump lands on the top of a platform', () => {
  const p = new CharacterPhysics(new CollisionWorld([{ minX: -1, maxX: 1, minZ: 0.3, maxZ: 5, top: 0.38 }])); p.jump(); simulate(p, 1.2, forward);
  assert.equal(p.y, 0.38); assert.ok(p.grounded); assert.ok(p.z > 0.5);
});
test('World boundary constrains an arbitrarily long run', () => {
  const p = new CharacterPhysics(new CollisionWorld()); simulate(p, 30, { ...forward, run: true }); assert.ok(p.z <= SETTINGS.boundary - SETTINGS.radius + 1e-5);
});
test('Reset clears velocity, jump and position state', () => {
  const p = new CharacterPhysics(new CollisionWorld()); simulate(p, 1, forward); p.jump(); simulate(p, 0.2); p.reset(); assert.deepEqual([p.x, p.y, p.z, p.vx, p.vy, p.vz, p.jumpCount], [0, 0, 0, 0, 0, 0, 0]); assert.equal(p.grounded, true);
});
test('The six facial presets are distinct and weights remain finite in [0,1]', () => {
  const signatures = new Set();
  for (const name of Object.keys(EMOTIONS)) {
    const f = new ExpressionState(); f.blinkEnabled = false; f.microEnabled = false; f.gazeEnabled = false; f.setEmotion(name);
    for (let i = 0; i < 300; i++) f.update(1 / 60);
    for (const value of Object.values(f.weights)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    signatures.add(JSON.stringify(Object.entries(f.weights).filter(([, v]) => v > 0.01)));
  }
  assert.equal(signatures.size, 6);
});
test('Changing expression eases into the new state instead of snapping', () => {
  const f = new ExpressionState(); f.setEmotion('angry'); f.update(1 / 60); assert.ok(f.weights.browDownLeft > 0 && f.weights.browDownLeft < 0.2);
});
test('Neutral returns jaw and mouth to zero without stale morphs', () => {
  const f = new ExpressionState(); f.setEmotion('laugh'); for (let i = 0; i < 120; i++) f.update(1 / 60);
  assert.ok(f.weights.jawOpen > 0.1); f.setEmotion('neutral'); for (let i = 0; i < 120; i++) f.update(1 / 60); assert.ok(f.weights.jawOpen < 0.0001);
});
test('A blink opens back up and suppresses eye-wide during closure', () => {
  const f = new ExpressionState(); f.blinkEnabled = false; f.setEmotion('surprise'); for (let i = 0; i < 120; i++) f.update(1 / 60); f.blink();
  let max = 0; for (let i = 0; i < 40; i++) { f.update(1 / 120); max = Math.max(max, f.weights.eyeBlinkLeft); }
  assert.ok(max > 0.98); assert.equal(f.weights.eyeBlinkLeft, 0);
});
test('Manual face controls are cleared by the next preset selection', () => {
  const f = new ExpressionState(); f.setManual('jaw', 0.9); assert.equal(f.manual.jawOpen, 0.9); f.setEmotion('sad'); assert.deepEqual(f.manual, {});
});
test('Shape mapping drives multiple meshes with the same morph and clears unrelated morphs', () => {
  const nodes = [1, 2].map(() => ({ morphTargetDictionary: { mouthSmileLeft: 0, jawOpen: 1, viseme_sil: 2 }, morphTargetInfluences: [0, 0, 0.8] }));
  const rig = new FaceRig({ traverse: fn => nodes.forEach(fn) }); rig.apply({ mouthSmileLeft: 0.6, jawOpen: 0.2 });
  for (const n of nodes) assert.deepEqual(n.morphTargetInfluences, [0.6, 0.2, 0]);
  assert.equal(normalizeShape('Eye_Blink_Left'), 'eyeblinkleft');
});
test('Micro-motion random sequence is reproducible for QA', () => { const a = seededRandom(7), b = seededRandom(7); for (let i = 0; i < 20; i++) assert.equal(a(), b()); });
