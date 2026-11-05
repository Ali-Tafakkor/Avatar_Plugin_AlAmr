import test from 'node:test';
import assert from 'node:assert/strict';
import { LaughterConfidenceGate, summarizeLaughterScores } from '../src/speech/laughter-core.mjs';
const scores = values => { const result = new Float32Array(521); for (const [index, value] of Object.entries(values)) result[Number(index)] = value; return result; };

test('recognized laughter taxonomy aggregates its strongest subtype without adding overlapping probabilities', () => {
  const result = summarizeLaughterScores(scores({ 0: 0.7, 13: 0.55, 15: 0.6, 17: 0.3 }));
  assert.equal(result.label, 'Giggle');
  assert.ok(Math.abs(result.rawScore - 0.6) < 1e-6);
  assert.ok(Math.abs(result.speechScore - 0.7) < 1e-6);
});
test('ordinary speech and loud unrelated events do not produce laughter', () => {
  const gate = new LaughterConfidenceGate();
  for (let i = 0; i < 8; i++) assert.equal(gate.update(scores({ 0: 0.97, 13: 0.03, 132: 0.8 }), i * 500).score, 0);
});
test('two qualified windows admit laughing speech; low score exits without trapping the expression', () => {
  const gate = new LaughterConfidenceGate();
  assert.equal(gate.update(scores({ 0: 0.8, 13: 0.5 }), 0).active, false);
  assert.equal(gate.update(scores({ 0: 0.8, 13: 0.5 }), 500).active, true);
  assert.equal(gate.update(scores({ 0: 0.85, 13: 0.10 }), 1000).score, 0);
});
test('strong explicit laughter starts immediately and stale windows cannot count toward a new event', () => {
  const gate = new LaughterConfidenceGate();
  assert.equal(gate.update(scores({ 17: 0.9 }), 0).active, true);
  assert.equal(gate.update(scores({ 0: 0.8, 13: 0.45 }), 3000).active, false);
  assert.equal(gate.update(scores({ 0: 0.8, 13: 0.45 }), 3500).active, true);
});
test('a clearly dominant laugh event is admitted without requiring a second long window', () => {
  const gate = new LaughterConfidenceGate();
  assert.equal(gate.update(scores({ 13: 0.38, 0: 0.35 }), 0).active, true);
});
test('nonfinite outputs and older timestamp cannot inject invalid or regressive state', () => {
  const gate = new LaughterConfidenceGate();
  assert.equal(gate.update(scores({ 13: NaN, 15: Infinity }), 0).score, 0);
  assert.equal(gate.update(scores({ 13: 0.9 }), 500).active, true);
  assert.equal(gate.update(scores({ 13: 0 }), 100).active, true);
  gate.reset(); assert.equal(gate.active, false); assert.equal(gate.score, 0);
});
