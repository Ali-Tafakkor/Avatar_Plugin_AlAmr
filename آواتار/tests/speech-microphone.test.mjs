import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

// Test the actual browser controller without requesting the machine's real mic.
// TypeScript is transpiled in memory; emitted product files are not modified.
const sourceUrl = new URL('../src/speech/microphone.ts', import.meta.url);
const arkitUrl = new URL('../src/speech/arkit.ts', import.meta.url);
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const arkitModule = asModule(compile(await fs.readFile(arkitUrl, 'utf8')));
const compiled = compile(await fs.readFile(sourceUrl, 'utf8'))
  .replace("'./audio-core.mjs'", JSON.stringify(new URL('../src/speech/audio-core.mjs', import.meta.url).href))
  .replace("'./arkit.js'", JSON.stringify(arkitModule))
  .replaceAll('import.meta.url', JSON.stringify(sourceUrl.href));
const { createMicrophoneSpeechController } = await import(asModule(compiled));
const tick = () => new Promise(resolve => setImmediate(resolve));

function environment(t, options = {}) {
  const saved = new Map();
  const override = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const workers = [], worklets = [], contexts = [], tracks = [];
  const stream = () => {
    const track = { stopped: false, onended: null, stop() { this.stopped = true; }, getSettings() { return { deviceId: 'test-mic' }; } };
    tracks.push(track);
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  };
  class FakeWorker {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) { this.messages.push(message); if (message.type === 'prepare' && options.autoReady !== false) queueMicrotask(() => this.reply({ type: 'ready', warmupMs: 4 })); }
    reply(message) { this.onmessage?.({ data: message }); }
    terminate() { this.terminated = true; }
  }
  class FakeContext {
    constructor() { this.state = 'running'; this.closed = false; this.destination = {}; contexts.push(this); this.audioWorklet = { addModule: async () => {} }; }
    async resume() {}
    async close() { this.closed = true; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { const gain = { gain: { value: 1 }, connect() {}, disconnect() {} }; this.gain = gain; return gain; }
  }
  class FakeWorklet {
    constructor() { this.port = { onmessage: null }; worklets.push(this); }
    connect() {}
    disconnect() { this.disconnected = true; }
  }
  override('document', { baseURI: 'https://avatar.example.test/lab/' });
  override('navigator', { mediaDevices: { getUserMedia: options.getUserMedia ?? (async () => stream()), enumerateDevices: async () => [] } });
  override('Worker', FakeWorker); override('AudioContext', FakeContext); override('AudioWorkletNode', FakeWorklet);
  t.after(() => { for (const [name, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]; });
  const frames = [], statuses = [];
  const controller = createMicrophoneSpeechController({ modelBaseUrl: './models/', wasmBaseUrl: './onnx/',
    onFrame: frame => frames.push(frame), onStatus: status => statuses.push(status) });
  t.after(() => controller.dispose());
  return { controller, workers, worklets, contexts, tracks, stream, frames, statuses };
}

test('denied microphone permission is surfaced and does not initialize a model or audio graph', async t => {
  const env = environment(t, { getUserMedia: async () => { throw new DOMException('permission denied', 'NotAllowedError'); } });
  await assert.rejects(env.controller.start(), /permission denied/);
  assert.equal(env.controller.getStatus().phase, 'error');
  assert.equal(env.workers.length, 0); assert.equal(env.contexts.length, 0);
});

test('stop during pending permission closes a late-arriving stream without activating capture', async t => {
  let resolvePermission;
  const env = environment(t, { getUserMedia: () => new Promise(resolve => { resolvePermission = resolve; }) });
  const starting = env.controller.start(); env.controller.stop();
  resolvePermission(env.stream()); await starting;
  assert.equal(env.tracks[0].stopped, true); assert.equal(env.contexts.length, 0);
  assert.notEqual(env.controller.getStatus().phase, 'listening');
});

test('stop during model loading releases mic and prevents a late model result from starting capture', async t => {
  const env = environment(t, { autoReady: false });
  const starting = env.controller.start(); await tick();
  assert.equal(env.workers.length, 1); env.controller.stop();
  env.workers[0].reply({ type: 'ready', warmupMs: 2 }); await starting;
  assert.equal(env.tracks[0].stopped, true); assert.equal(env.contexts.length, 0);
  assert.equal(env.controller.getStatus().speaking, false);
});

test('stale inference cannot reopen the mouth after stop; graph never replays the mic', async t => {
  const env = environment(t); await env.controller.start();
  assert.equal(env.controller.getStatus().phase, 'listening');
  assert.equal(env.contexts[0].gain.gain.value, 0);
  env.worklets[0].port.onmessage({ data: { samples: new Float32Array(3200).fill(0.2), sampleRate: 16000 } });
  const job = env.workers[0].messages.find(message => message.type === 'infer');
  assert.ok(job); env.controller.stop(); const count = env.frames.length;
  env.workers[0].reply({ type: 'result', id: job.id, generation: job.generation, capturedAt: job.capturedAt,
    inferenceMs: 20, frames: [new Float32Array(52).fill(0.7)] });
  await tick(); assert.equal(env.frames.length, count);
  assert.equal(env.tracks[0].stopped, true); assert.equal(env.contexts[0].closed, true);
  assert.equal(env.frames.at(-1).speaking, false);
});

test('initial silence never starts inference or a speaking expression', async t => {
  const env = environment(t); await env.controller.start();
  env.worklets[0].port.onmessage({ data: { samples: new Float32Array(3200), sampleRate: 16000 } });
  assert.equal(env.workers[0].messages.filter(message => message.type === 'infer').length, 0);
  assert.equal(env.controller.getStatus().speaking, false);
  assert.equal(env.frames.at(-1).speaking, false);
});

test('restarting acquires a fresh stream and reuses only the loaded inference worker', async t => {
  const env = environment(t); await env.controller.start(); env.controller.stop(); await env.controller.start();
  assert.equal(env.workers.length, 1); assert.equal(env.tracks.length, 2);
  assert.equal(env.tracks[0].stopped, true); assert.equal(env.tracks[1].stopped, false);
  env.tracks[1].onended(); assert.equal(env.tracks[1].stopped, true);
  assert.equal(env.controller.getStatus().phase, 'ready');
});
