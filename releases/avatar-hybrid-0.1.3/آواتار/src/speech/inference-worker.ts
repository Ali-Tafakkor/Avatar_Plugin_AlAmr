/** Browser-only wav2arkit adapter. Session/tensor handling derives from
 * gsplat-talkinghead, MIT, Copyright (c) 2026 Navod Peiris; see NOTICE.md.
 * The host supplies local pinned assets. No audio leaves this worker/browser. */
import * as ort from 'onnxruntime-web/wasm';
import type { SpeechModelConfiguration, SpeechWorkerRequest, SpeechWorkerResponse } from './protocol.js';
import { selectSpeechInterval } from './audio-core.mjs';

const scope = globalThis as unknown as {
  postMessage(message: SpeechWorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<SpeechWorkerRequest>) => void) | null;
};
let session: ort.InferenceSession | null = null;
let preparing: Promise<void> | null = null;
let running = false;
let lastProgressAt = -Infinity;
function progress(loaded: number, total: number, phase: 'download' | 'initializing' | 'warmup') {
  const now = performance.now();
  if (phase === 'download' && loaded < total && now - lastProgressAt < 80) return;
  lastProgressAt = now; scope.postMessage({ type: 'progress', loaded, total, phase });
}

async function fetchBytes(url: string, progress: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`speech_model_download_failed:${response.status}:${url}`);
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    progress(bytes.length, bytes.length); return bytes;
  }
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length; progress(loaded, total);
  }
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function infer(samples: Float32Array, tailFrames: number, lookaheadFrames = 0) {
  if (!session) throw new Error('speech_model_not_ready');
  const input = new ort.Tensor('float32', samples, [1, samples.length]);
  let outputs: ort.InferenceSession.ReturnType | null = null;
  try {
    outputs = await session.run({ [session.inputNames[0]]: input });
    const output = outputs[session.outputNames[0]];
    const shape = output.dims;
    const count = shape[shape.length - 2], width = shape[shape.length - 1];
    if (width !== 52 || !Number.isFinite(count)) throw new Error(`speech_model_unexpected_output:${shape.join('x')}`);
    const data = output.data as Float32Array;
    return selectSpeechInterval(data, count, samples.length, tailFrames, lookaheadFrames);
  } finally {
    input.dispose();
    if (outputs) for (const output of Object.values(outputs)) output.dispose();
  }
}

async function fetchParts(parts: { file: string; bytes: number }[], base: string,
  onProgress: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const total = parts.reduce((sum, part) => sum + part.bytes, 0);
  const data = new Uint8Array(total); let offset = 0;
  for (const part of parts) {
    const response = await fetch(new URL(part.file, base).href);
    if (!response.ok || !response.body) throw new Error('speech_model_part_unavailable:' + part.file);
    const reader = response.body.getReader(); let partBytes = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      if (partBytes + value.length > part.bytes) throw new Error('speech_model_part_too_large:' + part.file);
      data.set(value, offset + partBytes); partBytes += value.length; onProgress(offset + partBytes, total);
    }
    if (partBytes !== part.bytes) throw new Error('speech_model_part_truncated:' + part.file);
    offset += partBytes;
  }
  return data;
}

async function prepare(configuration: SpeechModelConfiguration): Promise<void> {
  ort.env.wasm.wasmPaths = configuration.wasmBaseUrl;
  ort.env.wasm.numThreads = 1;
  // This module is already a dedicated Worker. Proxying again is unnecessary.
  ort.env.wasm.proxy = false;
  const loaded = [0, 0], totals = [0, 0];
  const report = (index: number) => (value: number, total: number) => {
    loaded[index] = value; totals[index] = total;
    progress(loaded[0] + loaded[1], totals[0] + totals[1], 'download');
  };
  const graphRequest = configuration.modelParts?.length
    ? fetchParts(configuration.modelParts, configuration.modelBaseUrl, report(0))
    : fetchBytes(new URL(configuration.modelFile, configuration.modelBaseUrl).href, report(0));
  const dataRequest = !configuration.dataFile ? Promise.resolve(null) : configuration.dataParts?.length
    ? fetchParts(configuration.dataParts, configuration.modelBaseUrl, report(1))
    : fetchBytes(new URL(configuration.dataFile, configuration.modelBaseUrl).href, report(1));
  const [modelBytes, tensorData] = await Promise.all([graphRequest, dataRequest]);
  const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };
  if (configuration.dataFile && tensorData) options.externalData = [{ path: configuration.dataFile, data: tensorData }];
  progress(1, 1, 'initializing');
  session = await ort.InferenceSession.create(modelBytes, options);
  scope.postMessage({ type: 'progress', loaded: 1, total: 1, phase: 'warmup' });
  const start = performance.now();
  await infer(new Float32Array(16000), 1);
  scope.postMessage({ type: 'ready', warmupMs: performance.now() - start });
}

scope.onmessage = event => {
  const message = event.data;
  if (message.type === 'prepare') {
    preparing ??= prepare(message.configuration);
    void preparing.catch(error => scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (running) {
    scope.postMessage({ type: 'error', id: message.id, generation: message.generation, message: 'speech_worker_concurrent_inference' });
    return;
  }
  running = true;
  void (async () => {
    const start = performance.now();
    try {
      const interval = await infer(message.samples, message.tailFrames, message.lookaheadFrames);
      scope.postMessage({ type: 'result', id: message.id, generation: message.generation, capturedAt: message.capturedAt, inferenceMs: performance.now() - start, ...interval }, interval.frames.map(frame => frame.buffer as ArrayBuffer));
    } catch (error) {
      scope.postMessage({ type: 'error', id: message.id, generation: message.generation, message: error instanceof Error ? error.message : String(error) });
    } finally { running = false; }
  })();
};
