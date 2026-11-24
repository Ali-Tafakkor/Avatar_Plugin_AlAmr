import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boundedContactRotation,
  deepestConvexContact,
  fitConvexContactRegion,
} from '../assets/runtime-kernel/hand-contact.mjs';

const axes = [[2, 0, 0], [-2, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const box = (x, y, z) => [-x, x].flatMap(a => [-y, y].flatMap(b => [-z, z].map(c => [a, b, c])));

test('fits an anisotropic region with normalised planes and optional padding', () => {
  const planes = fitConvexContactRegion(box(.12, .3, .08), axes, { paddingMeters: .002 });
  assert.deepEqual(planes[0], { normal: [1, 0, 0], limit: .122 });
  assert.equal(planes[2].limit, .302);
  assert.equal(planes[4].limit, .082);
});

test('reports the deepest interior hand sample and nearest exit direction', () => {
  const planes = fitConvexContactRegion(box(.12, .3, .08), axes);
  const hit = deepestConvexContact([[.2, 0, 0], [.113, 0, 0], [0, 0, -.06]], planes);
  assert.deepEqual(hit.point, [0, 0, -.06]);
  assert.deepEqual(hit.normal, [0, 0, -1]);
  assert.ok(Math.abs(hit.depthMeters - .02) < 1e-12);
});

test('releases when no sample penetrates, including exact boundary contact', () => {
  const planes = fitConvexContactRegion(box(.12, .3, .08), axes);
  assert.equal(deepestConvexContact([[.12, 0, 0], [0, 0, -.09]], planes), null);
  assert.equal(deepestConvexContact([], planes), null);
});

test('scales depth with a second fit and discards the declared extreme sample', () => {
  const points = [...box(.24, .6, .16), [5, 0, 0]];
  const planes = fitConvexContactRegion(points, axes, { quantile: .88 });
  assert.equal(planes[0].limit, .24);
  assert.ok(Math.abs(deepestConvexContact([[0, 0, .12]], planes).depthMeters - .04) < 1e-12);
});

test('turns toward the exit normal within the explicit angular budget', () => {
  const hit = { point: [0, -.3, 0], normal: [1, 0, 0], depthMeters: .02 };
  const step = boundedContactRotation(hit, [0, 0, 0], { maxRadians: .04, clearanceMeters: .003 });
  assert.ok(Math.hypot(step.axis[0], step.axis[1], step.axis[2] - 1) < 1e-12);
  assert.equal(step.radians, .04);
  assert.equal(step.limited, true);
  assert.ok(-hit.point[1] * Math.sin(step.radians) > 0);
  const clear = boundedContactRotation(hit, [0, 0, 0], { maxRadians: .1 });
  assert.ok(Math.abs(clear.radians - 1 / 15) < 1e-12);
  assert.equal(clear.limited, false);
});

test('skips degenerate lever and rejects invalid calibration', () => {
  const hit = { point: [.3, 0, 0], normal: [1, 0, 0], depthMeters: .02 };
  assert.equal(boundedContactRotation(hit, [0, 0, 0], { maxRadians: .1 }), null);
  assert.equal(boundedContactRotation(null, [0, 0, 0], { maxRadians: .1 }), null);
  assert.throws(() => fitConvexContactRegion(box(1, 1, 1), [[0, 0, 0], ...axes]), RangeError);
  assert.throws(() => boundedContactRotation(hit, [0, 0, 0], { maxRadians: -1 }), RangeError);
});
