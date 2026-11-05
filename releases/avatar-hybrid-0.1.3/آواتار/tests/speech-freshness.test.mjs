import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual controller in memory; no product output or real mic is
// changed. The fake clock makes a slow-inference path deterministic.
const sourceUrl = new URL('../src/speech/microphone.ts', import.meta.url);
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const arkit = asModule(compile(await fs.readFile(new URL('../src/speech/arkit.ts', import.meta.url), 'utf8')));
const compiled = compile(await fs.readFile(sourceUrl, 'utf8'))
  .replace("'./audio-core.mjs'", JSON.stringify(new URL('../src/speech/audio-core.mjs', import.meta.url).href))
  .replace("'./arkit.js'", JSON.stringify(arkit))
  .replaceAll('import.meta.url', JSON.stringify(sourceUrl.href));
const { createMicrophoneSpeechController } = await import(asModule(compiled));

async function environment(t) {
  let clock = 100, worker, worklet, pace;
  const saved = new Map();
  const override = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  class FakeWorker {
    constructor() { this.messages = []; worker = this; }
    postMessage(message) {
      this.messages.push(message);
      if (message.type === 'prepare') queueMicrotask(() => this.reply({ type: 'ready', warmupMs: 1 }));
    }
    reply(message) { this.onmessage?.({ data: message }); }
    terminate() {}
  }
  class FakeContext {
    constructor() { this.destination = {}; this.audioWorklet = { addModule: async () => {} }; }
    async resume() {}
    async close() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
  }
  class FakeWorklet {
    constructor() { this.port = { onmessage: null }; worklet = this; }
    connect() {}
    disconnect() {}
  }
  const track = { stop() {}, getSettings: () => ({ deviceId: 'test-mic' }) };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  override('document', { baseURI: 'http://127.0.0.1:5390/' });
  override('navigator', { mediaDevices: { getUserMedia: async () => stream } });
  override('performance', { now: () => clock });
  override('Worker', FakeWorker); override('AudioContext', FakeContext); override('AudioWorkletNode', FakeWorklet);
  override('setInterval', callback => { pace = callback; return 1; });
  override('clearInterval', () => { pace = null; });
  const frames = [];
  const controller = createMicrophoneSpeechController({ modelBaseUrl: '/models/', wasmBaseUrl: '/onnx/', onFrame: frame => frames.push(frame) });
  t.after(() => {
    controller.dispose();
    for (const [name, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name];
  });
  await controller.start();
  return {
    controller, frames,
    feed(at, level = .2) { clock = at; worklet.port.onmessage({ data: { samples: new Float32Array(3200).fill(level), sampleRate: 16000 } }); },
    jobs() { return worker.messages.filter(message => message.type === 'infer'); },
    result(job, at, timing = {}) {
      clock = at;
      worker.reply({ type: 'result', id: job.id, generation: job.generation, capturedAt: job.capturedAt,
        inferenceMs: at - job.capturedAt, frames: [new Float32Array(52).fill(.7)], ...timing });
    },
    pace(at) { clock = at; pace?.(); },
  };
}

test('a delayed result during uninterrupted speech cannot refresh the face, while the next fresh result still works', async t => {
  const env = await environment(t);
  env.feed(200); const old = env.jobs()[0];
  env.feed(1000); // same generation and still speaking: no stop/silence escape.
  env.result(old, 1200); env.pace(1233);
  assert.equal(env.controller.getStatus().phase, 'listening');
  assert.equal(env.controller.getStatus().speaking, true);
  assert.equal(env.frames.filter(frame => frame.speaking).length, 0);
  const fresh = env.jobs().at(-1);
  assert.equal(fresh.capturedAt, 1000);
  env.result(fresh, 1250); env.pace(1283);
  assert.equal(env.frames.filter(frame => frame.speaking).length, 1);
  assert.equal(env.frames.at(-1).capturedAt, 1000);
  assert.ok(env.frames.at(-1).weights.jawOpen > 0);
});

test('a frame accepted while fresh is discarded if it ages past900ms before its pacing tick', async t => {
  const env = await environment(t);
  env.feed(200); env.result(env.jobs()[0], 250);
  env.feed(800); env.feed(1050); // ongoing new audio keeps speaking active.
  const droppedBefore = env.controller.getStatus().droppedChunks;
  env.pace(1150);
  assert.equal(env.controller.getStatus().phase, 'listening');
  assert.equal(env.controller.getStatus().speaking, true);
  assert.equal(env.frames.filter(frame => frame.speaking).length, 0);
  assert.equal(env.controller.getStatus().droppedChunks, droppedBefore + 1);
});

test('rolling audio retains real future context and flushes the voiced tail on the first silent hop', async t => {
  const env = await environment(t);
  env.feed(200, .1); const first = env.jobs()[0];
  assert.equal(first.samples.length, 9600);
  assert.ok(first.samples.subarray(0, 6400).every(value => value === 0));
  assert.ok(first.samples.subarray(6400).every(value => Math.abs(value-.1)<1e-6));
  assert.equal(first.lookaheadFrames, 6);
  env.result(first, 300);
  env.feed(400, .2); const second = env.jobs().at(-1);
  assert.ok(second.samples.subarray(3200,6400).every(value => Math.abs(value-.1)<1e-6));
  assert.ok(second.samples.subarray(6400).every(value => Math.abs(value-.2)<1e-6));
  env.result(second, 500);
  env.feed(600, 0); const tail = env.jobs().at(-1);
  assert.equal(tail.capturedAt, 600, 'the first silent chunk must still enter inference');
  assert.ok(tail.samples.subarray(3200,6400).every(value => Math.abs(value-.2)<1e-6));
  assert.ok(tail.samples.subarray(6400).every(value => value === 0));
  env.feed(800, 0);
  assert.equal(env.controller.getStatus().speaking, false);
  env.result(tail, 850); env.pace(883);
  assert.equal(env.frames.at(-1).speaking, false, 'late voiced predictions cannot reopen a silent face');
});

test('interior output has acoustic timestamps and overlapping windows cannot replay old face frames', async t => {
  const env = await environment(t);
  const timing = { frameStartOffsetMs: -1100/3, frameIntervalMs: 1000/30,
    frames: Array.from({length:6},()=>new Float32Array(52).fill(.7)) };
  env.feed(200); env.result(env.jobs()[0], 350, timing); env.pace(383);
  assert.equal(env.frames.filter(frame=>frame.speaking).length, 0, 'left-padding frames are never displayed');
  env.feed(400); env.result(env.jobs().at(-1), 550, timing);
  for (let at=583; at<=750; at+=1000/30) env.pace(at);
  const first = env.frames.filter(frame=>frame.speaking);
  assert.equal(first.length, 6);
  assert.ok(Math.abs(first[0].capturedAt-100/3)<1e-6);
  assert.ok(Math.abs(first.at(-1).capturedAt-200)<1e-6);
  assert.ok(first.every(frame=>frame.latencyMs>=500), 'latency includes the acoustic lookahead/context age');
  // Deliberately return overlapping source coverage: only the new final frame
  // may advance the face, even though this inference call itself is fresh.
  env.feed(410); env.result(env.jobs().at(-1), 760, timing);
  for(let at=793;at<=960;at+=1000/30)env.pace(at);
  const all = env.frames.filter(frame=>frame.speaking);
  assert.equal(all.length, 7);
  assert.ok(all.every((frame,index)=>!index||frame.capturedAt>all[index-1].capturedAt));
  assert.ok(Math.abs(all.at(-1).capturedAt-210)<1e-6);
});
