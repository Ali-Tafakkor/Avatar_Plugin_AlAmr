import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSoleContacts, clampLimbReach, composeLocalOffset, warpRelativeMorphs } from '../assets/runtime-kernel/calibration.mjs';
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const base = (scale = 1, floor = 0) => ({
  heel: { along: 0, height: floor + 0.016 * scale, supportHeight: floor },
  forefoot: { along: 0.23 * scale, height: floor + 0.002 * scale, supportHeight: floor },
  pivot: { along: 0.05 * scale, height: floor + 0.08 * scale },
  maxPitchRadians: 0.3, maxShiftMeters: 0.05 * scale,
  grounded: true, stance: true,
});

test('static heel and forefoot both meet the plane after a bounded rigid fit', () => {
  const r = fitSoleContacts(base()); assert.equal(r.active, true); assert.equal(r.limited, false);
  near(r.residuals.heel, 0); near(r.residuals.forefoot, 0);
  assert.ok(r.pitchRadians > 0, 'raises the lower forefoot relative to the heel before translation');
});
test('the same method scales to different bodies/shoes and translated ground', () => {
  const reference = fitSoleContacts(base());
  for (const scale of [0.45, 0.8, 1.4, 2.2]) for (const floor of [-3, 0, 12]) {
    const r = fitSoleContacts(base(scale, floor));
    near(r.pitchRadians, reference.pitchRadians); near(r.shiftMeters, reference.shiftMeters * scale);
    near(r.residuals.maxAbs, 0);
  }
});
test('author-defined high-heel contact patches are not flattened to an ankle identity', () => {
  const data = base(); data.heel.height = data.forefoot.height = 0;
  // Heel tip and forefoot are already supported; ankle/arch pose stays upstream.
  const r = fitSoleContacts(data); near(r.pitchRadians, 0); near(r.shiftMeters, 0);
});
test('local planar incline supports two different patch heights', () => {
  const data = base(); data.forefoot.supportHeight = 0.02;
  const r = fitSoleContacts(data); near(r.residuals.heel, 0); near(r.residuals.forefoot, 0);
});
test('swing, air, gesture override and zero weight release instead of pinning feet', () => {
  for (const patch of [{ grounded: false }, { stance: false }, { override: true }, { weight: 0 }]) {
    const r = fitSoleContacts({ ...base(), ...patch }); assert.equal(r.active, false);
    near(r.pitchRadians, 0); near(r.shiftMeters, 0);
  }
});
test('small correction limits report residuals and never conceal penetration', () => {
  const r = fitSoleContacts({ ...base(), maxPitchRadians: 0.001, maxShiftMeters: 0.001 });
  assert.equal(r.limited, true); assert.ok(r.residuals.maxAbs > 0.001);
  assert.ok(Math.abs(r.shiftMeters) <= 0.001); assert.ok(Math.abs(r.pitchRadians) <= 0.001);
});
test('partial contact weight leaves a partial correction and immutable inputs', () => {
  const data = base(), original = structuredClone(data), full = fitSoleContacts(data);
  const half = fitSoleContacts({ ...data, weight: 0.5 });
  near(half.pitchRadians, full.pitchRadians * 0.5); assert.ok(half.residuals.maxAbs > 0);
  assert.deepEqual(data, original);
});
test('missing an intended clearance is not falsely called physical ground penetration', () => {
  const data = base();
  data.heel.height = data.forefoot.height = 0.005;
  data.heel.clearanceMeters = data.forefoot.clearanceMeters = 0.01;
  data.maxShiftMeters = 0.001;
  const r = fitSoleContacts(data);
  assert.ok(r.residuals.maxClearanceDeficit > 0);
  near(r.residuals.maxPenetration, 0);
});
test('invalid or degenerate calibration fails rather than emitting NaNs', () => {
  for (const mutate of [d => d.heel.height = NaN, d => d.maxShiftMeters = -1,
    d => d.forefoot.along = d.heel.along, d => d.weight = 2, d => d.maxPitchRadians = Infinity]) {
    const d = base(); mutate(d); assert.throws(() => fitSoleContacts(d));
  }
});
test('unreachable support-height difference remains finite and explicitly limited', () => {
  const data = base(); data.forefoot.supportHeight = 2;
  const r = fitSoleContacts(data); assert.equal(r.unreachableSupportDelta, true);
  assert.equal(r.limited, true); assert.ok(Number.isFinite(r.residuals.maxAbs));
});
test('two-leg reach clamps at scale-dependent limits without stretching', () => {
  for (const scale of [0.1, 1, 4]) {
    const stretched = clampLimbReach(2 * scale, 0.45 * scale, 0.4 * scale);
    assert.ok(stretched.distance < 0.85 * scale); assert.equal(stretched.limited, true);
    const folded = clampLimbReach(0, 0.45 * scale, 0.4 * scale);
    assert.ok(folded.distance > 0.05 * scale); assert.ok(Number.isFinite(folded.distance));
  }
  assert.throws(() => clampLimbReach(1, 0, 1));
});
test('rest offsets are applied from fresh base without long-run accumulated drift', () => {
  const q = [0, 0, 0, 1], angle = 0.2, delta = [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
  const expected = composeLocalOffset(q, delta, 0.5);
  for (let frame = 0; frame < 10000; frame++) assert.deepEqual(composeLocalOffset(q, delta, 0.5), expected);
  near(Math.hypot(...expected), 1); near(2 * Math.atan2(expected[0], expected[3]), 0.1);
  assert.deepEqual(composeLocalOffset(q, delta, 0), q);
});
test('independently calibrated mirrored finger axes bend in opposite local directions', () => {
  const q = [0, 0, 0, 1], a = 0.3;
  const left = composeLocalOffset(q, [Math.sin(a / 2), 0, 0, Math.cos(a / 2)], 1);
  const right = composeLocalOffset(q, [-Math.sin(a / 2), 0, 0, Math.cos(a / 2)], 1);
  near(left[0], -right[0]); near(left[3], right[3]);
  assert.throws(() => composeLocalOffset([0, 0, 0, 0], q, 1));
});
test('q and -q represent the same offset and caller arrays stay unchanged', () => {
  const q = [0, 0, 0, 1], d = [0, Math.sin(0.2), 0, Math.cos(0.2)], copy = [...d];
  const a = composeLocalOffset(q, d, 0.7), b = composeLocalOffset(q, d.map(v => -v), 0.7);
  a.forEach((v, i) => near(v, b[i])); assert.deepEqual(d, copy);
});
test('nonlinear identity sculpt preserves every transformed expression endpoint', () => {
  const b = [[1, 2, 3], [-0.4, 0.5, 2]], d = [[[0.2, -0.1, 0.3], [0, 0.1, -0.2]]];
  const before = structuredClone({ b, d }), F = ([x, y, z]) => [x + 0.1 * y * y, 1.1 * y, z + 0.05 * x * x];
  const result = warpRelativeMorphs(b, d, F);
  b.forEach((point, vertex) => {
    const expected = F(point.map((v, i) => v + d[0][vertex][i]));
    expected.forEach((v, i) => near(result.base[vertex][i] + result.targets[0][vertex][i], v));
  });
  assert.deepEqual({ b, d }, before);
});
test('invalid morph shapes or nonfinite warp results fail explicitly', () => {
  assert.throws(() => warpRelativeMorphs([[0, 0, 0]], [[]], p => p));
  assert.throws(() => warpRelativeMorphs([[0, 0, 0]], [], () => [NaN, 0, 0]));
});
