import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechCompositor, SPEECH_CHANNELS } from '../src/speech/compositor.mjs';

function fixture() {
  let now = 1000;
  const compositor = new SpeechCompositor({ clock: () => now });
  const advance = (base = {}, seconds = 0.25, step = 1 / 60) => {
    let weights = base;
    for (let t = 0; t < seconds; t += step) { now += step * 1000; weights = compositor.compose(base, step); }
    return weights;
  };
  return { compositor, advance, now: () => now, setNow: value => { now = value; } };
}

test('idle composition preserves accepted facial weights and does not mutate the base', () => {
  const { compositor, advance } = fixture();
  const base = { jawOpen: 0.23, eyeBlinkLeft: 0.7, eyeWideLeft: 0.8, eyeLookOutLeft: 0.2, identityShape: 0.6 };
  assert.deepEqual(advance(base, 2), base);
  assert.equal(compositor.getStatus().frames, 0);
  assert.equal(compositor.getStatus().active, false);
  assert.deepEqual(base, { jawOpen: 0.23, eyeBlinkLeft: 0.7, eyeWideLeft: 0.8, eyeLookOutLeft: 0.2, identityShape: 0.6 });
});

test('raw speech deforms lower face while retaining eyes, gaze and existing identity', () => {
  const { compositor, advance } = fixture();
  const base = { eyeBlinkLeft: 1, eyeBlinkRight: 0.98, eyeWideLeft: 0.4, eyeLookOutLeft: 0.23, identityShape: 0.6,
    mouthSmileLeft: 0.15, browDownRight: 0.3 };
  compositor.setFrame({ jawOpen: 0.12, mouthPucker: 0.2, eyeBlinkLeft: 0, eyeLookOutLeft: 1, tongueOut: 1, unknown: 1 });
  const result = advance(base);
  assert.ok(result.jawOpen > 0.30 && result.jawOpen < 0.34);
  assert.ok(result.mouthPucker > 0.32);
  assert.equal(result.eyeBlinkLeft, 1);
  assert.equal(result.eyeBlinkRight, 0.98);
  assert.equal(result.eyeWideLeft, 0);
  assert.equal(result.eyeLookOutLeft, 0.23);
  assert.equal(result.browDownRight, 0.3);
  assert.equal(result.identityShape, 0.6);
  assert.equal(Object.hasOwn(result, 'tongueOut'), false);
  assert.equal(Object.hasOwn(result, 'unknown'), false);
  assert.equal(SPEECH_CHANNELS.some(name => name.startsWith('eye')), false);
});

test('phoneme jaw overrides a laughing preset without fabricating extra oscillation', () => {
  const { compositor, advance } = fixture();
  compositor.setFrame({ jawOpen: 0.015, mouthClose: 0.45 });
  const result = advance({ jawOpen: 0.3, mouthSmileLeft: 0.72, cheekSquintLeft: 0.35 });
  assert.ok(result.jawOpen < 0.05, 'closed syllable should close an otherwise laughing jaw');
  assert.ok(result.mouthSmileLeft > 0.45, 'mood mouth corner should remain');
  assert.equal(result.cheekSquintLeft, 0.35);
});

test('silence and stale audio release back to the selected emotion/manual baseline', () => {
  const { compositor, advance } = fixture();
  const base = { jawOpen: 0.07, mouthSmileLeft: 0.22, browInnerUp: 0.4 };
  compositor.setFrame({ jawOpen: 0.18, mouthSmileLeft: 0.3 });
  assert.ok(advance(base, 0.2).jawOpen > 0.4);
  compositor.setFrame({}, { speaking: false });
  const result = advance(base, 1.3);
  assert.deepEqual(result, base);
  compositor.setFrame({ jawOpen: 0.18 });
  advance(base, 0.2);
  assert.deepEqual(advance(base, 2), base);
  assert.equal(compositor.getStatus().speaking, false);
});

test('late timestamped result is rejected and cannot overwrite newer silence', () => {
  const { compositor, advance, now } = fixture();
  compositor.setFrame({}, { at: now(), speaking: false });
  compositor.setFrame({ jawOpen: 1 }, { at: now() - 30 });
  assert.deepEqual(advance({}), {});
  assert.equal(compositor.getStatus().frames, 1);
});

test('laughter uses independent freshness and cheeks without forcing jaw motion', () => {
  const { compositor, advance, now } = fixture();
  compositor.setLaughter(0.9, { at: now() });
  const result = advance({ eyeBlinkLeft: 1, eyeLookUpLeft: 0.13 }, 0.5);
  assert.ok(result.mouthSmileLeft > 0.48);
  assert.ok(result.cheekSquintLeft > 0.22);
  assert.equal(Object.hasOwn(result, 'jawOpen'), false);
  assert.equal(result.eyeBlinkLeft, 1);
  assert.equal(result.eyeLookUpLeft, 0.13);
  assert.deepEqual(advance({}, 4), {});
});

test('bounds, nonfinite input, disable and clear protect independent instances', () => {
  const a = fixture(), b = fixture();
  a.compositor.setFrame({ jawOpen: 999, mouthFunnel: Infinity, mouthPucker: NaN, jawLeft: -8 });
  a.compositor.setLaughter(2);
  const result = a.advance({}, 0.2);
  for (const value of Object.values(result)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  assert.ok(result.jawOpen <= 0.58);
  assert.equal(result.mouthFunnel, 0);
  assert.equal(result.mouthPucker, 0);
  assert.equal(result.jawLeft, 0);
  assert.deepEqual(b.advance({ jawOpen: 0.05 }), { jawOpen: 0.05 });
  a.compositor.setOptions({ enabled: false });
  assert.deepEqual(a.advance({}, 3), {});
  a.compositor.setOptions({ enabled: true, gain: 1, laughterEnabled: false });
  a.compositor.setLaughter(1);
  assert.deepEqual(a.advance({}, 0.4), {});
  a.compositor.clear();
  assert.equal(a.compositor.getStatus().active, false);
  assert.deepEqual(a.advance({ jawOpen: 0.05 }), { jawOpen: 0.05 });
});
