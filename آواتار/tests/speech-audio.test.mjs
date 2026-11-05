import test from 'node:test';
import assert from 'node:assert/strict';
import { appendRecent, padAudioContext, resampleMono, rms, selectSpeechInterval } from '../src/speech/audio-core.mjs';

test('resampling preserves a speech-band tone and rejects aliases above target Nyquist', () => {
  const tone = frequency => Float32Array.from({ length: 4800 }, (_, i) => Math.sin(2 * Math.PI * frequency * i / 48000));
  const voice = resampleMono(tone(1000), 48000);
  const ultrasonic = resampleMono(tone(12000), 48000);
  assert.equal(voice.length, 1600);
  assert.ok(rms(voice.subarray(30, -30)) > 0.65);
  assert.ok(rms(ultrasonic.subarray(30, -30)) < 0.02);
});

test('audio tail has a strict memory bound and preserves the freshest samples', () => {
  const previous = new Float32Array([1, 2, 3, 4]);
  assert.deepEqual([...appendRecent(previous, new Float32Array([5, 6]), 4)], [3, 4, 5, 6]);
  assert.deepEqual([...appendRecent(previous, new Float32Array([5, 6, 7, 8, 9]), 3)], [7, 8, 9]);
  assert.deepEqual([...appendRecent(previous, new Float32Array([5]), 0)], []);
  assert.deepEqual([...previous], [1, 2, 3, 4]);
});

test('silence and malformed PCM cannot produce nonfinite resampled speech', () => {
  const result = resampleMono(new Float32Array([0, NaN, Infinity, 0, 0, 0]), 48000);
  assert.ok(result.every(Number.isFinite));
  assert.equal(rms(new Float32Array(0)), 0);
  assert.throws(() => resampleMono(new Float32Array(3), 0), /sample_rate/);
});

test('a held vowel emits its stable interior while decoder window edges remain unplayed', () => {
  const data = new Float32Array(18 * 52);
  // Decoder calls repeatedly have artificial onset and closing edge motion.
  const jaw = [.02,.04,.06,.07,.075,.079, .08,.08,.08,.08,.08,.08, .079,.075,.07,.06,.04,.02];
  jaw.forEach((value, frame) => { data[frame * 52 + 24] = value; });
  const selected = selectSpeechInterval(data, 18, 9600, 6, 6);
  assert.equal(selected.frames.length, 6);
  const values = selected.frames.map(frame => frame[24]);
  assert.equal(Math.max(...values) - Math.min(...values), 0,
    'steady audio must not replay the model call\'s onset/closing animation');
  assert.ok(Math.abs(selected.frameStartOffsetMs + 366.6666667) < .0001);
  assert.equal(selected.frameIntervalMs, 1000 / 30);
  assert.ok(Math.abs(selected.frameStartOffsetMs + 5 * selected.frameIntervalMs + 200) < .0001,
    'the last emitted frame must describe audio captured 200ms before the input ended');
  const audio = new Float32Array([.1,.2]);
  assert.deepEqual([...padAudioContext(audio, 4)], [0,0,...audio]);
  assert.deepEqual([...audio], [.1,.2].map(Math.fround));
});
