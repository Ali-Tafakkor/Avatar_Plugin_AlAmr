import test from 'node:test';
import assert from 'node:assert/strict';
import { LaughterDetector } from '../src/speech/laughter.ts';

class FakeWorker {
  static instances = [];
  constructor() { this.messages = []; this.terminated = false; FakeWorker.instances.push(this); }
  postMessage(message) { this.messages.push(message); }
  emit(data) { this.onmessage?.({ data }); }
  terminate() { this.terminated = true; }
}
globalThis.Worker = FakeWorker;
globalThis.document = { baseURI: 'http://127.0.0.1:5390/' };
const audio = new Float32Array(3200).fill(0.1);
const silence = new Float32Array(3200);
const strongScores = new Float32Array(521); strongScores[13] = 0.9;
const create = () => {
  const events = [], statuses = [];
  const detector = new LaughterDetector({ modelUrl: '/models/yamnet.onnx', wasmBaseUrl: '/onnx', workerUrl: '/workers/laughter.js',
    onScore: result => events.push(result), onStatus: status => statuses.push(status) });
  return { detector, events, statuses };
};
const ready = async detector => { const started = detector.start(); const worker = FakeWorker.instances.at(-1); worker.emit({ type: 'ready' }); await started; return worker; };

test('only one classifier request is in flight and pending windows keep the latest captured audio', async () => {
  const { detector, events } = create(); const worker = await ready(detector);
  for (let i = 0; i < 12; i++) detector.pushAudio(audio, 16000, i * 200);
  assert.equal(worker.messages.filter(m => m.type === 'infer').length, 1);
  worker.emit({ type: 'result', scores: strongScores, at: 800, inferenceMs: 30 });
  const requests = worker.messages.filter(m => m.type === 'infer');
  assert.equal(requests.length, 2); assert.equal(requests[1].at, 2000);
  // The result from the old 800ms window has become stale at2200ms.
  assert.equal(events.length, 0);
  worker.emit({ type: 'result', scores: strongScores, at: 2000, inferenceMs: 30 });
  assert.equal(events.at(-1).active, true);
  detector.stop();
});
test('confirmed silence clears laughter and an older inference result cannot bring it back', async () => {
  const { detector, events } = create(); const worker = await ready(detector);
  for (let i = 0; i < 5; i++) detector.pushAudio(audio, 16000, i * 200);
  detector.pushAudio(silence, 16000, 1000); detector.pushAudio(silence, 16000, 1200);
  assert.equal(events.at(-1).score, 0);
  worker.emit({ type: 'result', scores: strongScores, at: 800, inferenceMs: 30 });
  assert.equal(events.at(-1).score, 0);
  detector.stop();
});
test('stop cancels loading, terminates owned worker and ignores its subsequent messages', async () => {
  const { detector, events } = create(); const starting = detector.start();
  const worker = FakeWorker.instances.at(-1);
  detector.stop();
  await assert.rejects(starting, /start_cancelled/);
  assert.equal(worker.terminated, true);
  const before = events.length; worker.emit({ type: 'result', scores: strongScores, at: 100, inferenceMs: 0 });
  assert.equal(events.length, before);
  const replacement = await ready(detector); assert.notEqual(worker, replacement);
  detector.stop();
});
test('a resumed utterance waits for fresh context instead of reclassifying a laugh from before silence', async () => {
  const { detector } = create(); const worker = await ready(detector);
  for (let i = 0; i < 5; i++) detector.pushAudio(audio, 16000, i * 200);
  detector.pushAudio(silence, 16000, 1000); detector.pushAudio(silence, 16000, 1200);
  worker.emit({ type: 'result', scores: strongScores, at: 800, inferenceMs: 30 });
  for (let i = 0; i < 4; i++) detector.pushAudio(audio, 16000, 1400 + i * 200);
  assert.equal(worker.messages.filter(message => message.type === 'infer').length, 1);
  detector.pushAudio(audio, 16000, 2200);
  assert.equal(worker.messages.filter(message => message.type === 'infer').length, 2);
  assert.equal(worker.messages.at(-1).at, 2200);
  detector.stop();
});
test('initialization errors are visible and the detector can retry with a fresh worker', async () => {
  const { detector, statuses } = create(); const starting = detector.start();
  FakeWorker.instances.at(-1).emit({ type: 'error', message: 'missing_model' });
  await assert.rejects(starting, /missing_model/);
  assert.equal(statuses.at(-1).state, 'error');
  await ready(detector); assert.equal(statuses.at(-1).state, 'ready');
  detector.stop();
});
test('a result older than the wall-clock freshness limit is rejected even if capture stopped producing chunks', async () => {
  const { detector, events } = create(); const worker = await ready(detector);
  const capturedAt = performance.now() - 2000;
  for (let i = 0; i < 5; i++) detector.pushAudio(audio, 16000, capturedAt - 800 + i * 200);
  worker.emit({ type: 'result', scores: strongScores, at: capturedAt, inferenceMs: 2000 });
  assert.equal(events.length, 0);
  detector.stop();
});
