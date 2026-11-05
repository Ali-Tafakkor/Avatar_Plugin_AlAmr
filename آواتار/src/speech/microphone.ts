import { appendRecent, padAudioContext, resampleMono, rms } from './audio-core.mjs';
import { namedWeights, type SpeechWeights } from './arkit.js';
import type { SpeechModelConfiguration, SpeechWorkerRequest, SpeechWorkerResponse } from './protocol.js';

export const SPEECH_WORKER_URL = new URL('../assets/speech/workers/inference-worker.js', import.meta.url).href;
export const SPEECH_CAPTURE_WORKLET_URL = new URL('../assets/speech/workers/capture-worklet.js', import.meta.url).href;
export type MicrophoneSpeechPhase = 'idle' | 'loading' | 'ready' | 'requesting' | 'listening' | 'error' | 'disposed';
export interface MicrophoneSpeechFrame {
  weights: SpeechWeights;
  /** Delivery time on performance.now(), directly compatible with the runtime compositor. */
  timestamp: number;
  capturedAt: number;
  inferenceMs: number;
  /** Capture-to-display age estimate, not measured acoustic end-to-end latency. */
  latencyMs: number;
  speaking: boolean;
}
export interface MicrophoneSpeechStatus {
  phase: MicrophoneSpeechPhase;
  modelPhase: 'idle' | 'download' | 'initializing' | 'warmup' | 'ready';
  modelProgress: number;
  level: number;
  speaking: boolean;
  frames: number;
  inferenceMs: number;
  latencyMs: number;
  warmupMs: number;
  droppedChunks: number;
  deviceId: string;
  error: string | null;
}
export interface MicrophoneSpeechOptions {
  modelBaseUrl: string;
  wasmBaseUrl: string;
  modelFile?: string;
  modelParts?: { file: string; bytes: number }[];
  dataFile?: string | null;
  dataParts?: { file: string; bytes: number }[];
  workerUrl?: string;
  captureWorkletUrl?: string;
  /** RMS gate, before display-level scaling. Default 0.003. */
  noiseGate?: number;
  /** Rolling acoustic context. 200ms matches the reviewed upstream pipeline. */
  contextMs?: number;
  onFrame(frame: MicrophoneSpeechFrame): void;
  onStatus?(status: MicrophoneSpeechStatus): void;
  /** Independent classifier input; always mono16k, including silent chunks. */
  onAudioChunk?(samples: Float32Array, sampleRate: number, timestamp: number): void;
}
export interface MicrophoneSpeechController {
  prepare(): Promise<void>;
  start(options?: { deviceId?: string }): Promise<void>;
  stop(): void;
  dispose(): void;
  listDevices(): Promise<MediaDeviceInfo[]>;
  setNoiseGate(value: number): void;
  getStatus(): MicrophoneSpeechStatus;
}

type PendingChunk = { samples: Float32Array; capturedAt: number; generation: number };
type QueuedFrame = { weights: SpeechWeights; capturedAt: number; inferenceMs: number };
const now = () => performance.now();
const directory = (value: string) => {
  const url = new URL(value, document.baseURI); if (!url.pathname.endsWith('/')) url.pathname += '/'; return url.href;
};

/** Owns only its microphone/audio graph and worker, never the avatar RAF or renderer. */
export function createMicrophoneSpeechController(options: MicrophoneSpeechOptions): MicrophoneSpeechController {
  const configuration: SpeechModelConfiguration = {
    modelBaseUrl: directory(options.modelBaseUrl), wasmBaseUrl: directory(options.wasmBaseUrl),
    modelFile: options.modelFile ?? 'wav2arkit_cpu.onnx',
    modelParts: options.modelParts,
    dataFile: options.dataFile === undefined ? 'wav2arkit_cpu.onnx.data' : options.dataFile,
    dataParts: options.dataParts,
  };
  const state: MicrophoneSpeechStatus = { phase: 'idle', modelPhase: 'idle', modelProgress: 0, level: 0, speaking: false,
    frames: 0, inferenceMs: 0, latencyMs: 0, warmupMs: 0, droppedChunks: 0, deviceId: '', error: null };
  let worker: Worker | null = null, modelReady = false, disposed = false;
  let preparation: Promise<void> | null = null;
  let resolvePreparation: (() => void) | null = null, rejectPreparation: ((error: Error) => void) | null = null;
  let generation = 0, nextId = 0, inFlightId: number | null = null;
  let stream: MediaStream | null = null, context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null, capture: AudioWorkletNode | null = null, mute: GainNode | null = null;
  let paceTimer: ReturnType<typeof setInterval> | null = null;
  let queue: QueuedFrame[] = [], pending: PendingChunk | null = null, recent: Float32Array = new Float32Array(0);
  let silentChunks = 0, silenceAt = -Infinity, noiseGate = options.noiseGate ?? 0.003;
  // A 200ms independent model call repeats its onset/end transients at 5Hz.
  // Keep 200ms of past context and 200ms of real lookahead around each new hop.
  const contextSamples = Math.round(16000 * Math.max(0.6, Math.min(1, (options.contextMs ?? 600) / 1000)));
  let audioStartedAt = Infinity, lastQueuedSourceAt = -Infinity;
  const publish = () => options.onStatus?.({ ...state });
  const clearFrame = () => options.onFrame({ weights: {}, timestamp: now(), capturedAt: now(), inferenceMs: 0, latencyMs: 0, speaking: false });
  function drain() {
    if (!worker || !modelReady || inFlightId !== null || !pending || state.phase !== 'listening') return;
    const chunk = pending; pending = null;
    inFlightId = ++nextId;
    const message: SpeechWorkerRequest = { type: 'infer', id: inFlightId, generation: chunk.generation,
      samples: chunk.samples, capturedAt: chunk.capturedAt, tailFrames: 6, lookaheadFrames: 6 };
    worker.postMessage(message, [chunk.samples.buffer as ArrayBuffer]);
  }
  function onWorkerMessage(event: MessageEvent<SpeechWorkerResponse>) {
    if (disposed) return;
    const message = event.data;
    if (message.type === 'progress') {
      state.modelPhase = message.phase;
      state.modelProgress = message.total > 0 ? Math.min(1, message.loaded / message.total) : 0;
      publish(); return;
    }
    if (message.type === 'ready') {
      modelReady = true; state.modelPhase = 'ready'; state.modelProgress = 1; state.warmupMs = message.warmupMs;
      if (state.phase === 'loading') state.phase = 'ready';
      resolvePreparation?.(); resolvePreparation = null; rejectPreparation = null; publish(); return;
    }
    if (message.type === 'error') {
      if (message.id !== undefined && message.id !== inFlightId) return;
      inFlightId = null;
      const error = new Error(message.message);
      rejectPreparation?.(error); resolvePreparation = null; rejectPreparation = null;
      preparation = null; modelReady = false; worker?.terminate(); worker = null;
      stop(); state.phase = 'error'; state.error = message.message; publish(); return;
    }
    if (message.id !== inFlightId) return;
    inFlightId = null;
    if (message.generation === generation && state.phase === 'listening' && message.capturedAt > silenceAt && state.speaking && now() - message.capturedAt < 900) {
      state.inferenceMs = message.inferenceMs;
      const startOffset = Number.isFinite(message.frameStartOffsetMs) ? message.frameStartOffsetMs : 0;
      const interval = Number.isFinite(message.frameIntervalMs) ? message.frameIntervalMs : 1000 / 30;
      for (let index = 0; index < message.frames.length; index++) {
        const capturedAt = message.capturedAt + startOffset + index * interval;
        // Do not show left-padding predictions or replay overlapping old audio
        // if inference falls behind and a pending window replaces another.
        if (capturedAt <= audioStartedAt || capturedAt <= lastQueuedSourceAt + 0.01 || now() - capturedAt >= 900) continue;
        queue.push({ weights: namedWeights(message.frames[index]), capturedAt, inferenceMs: message.inferenceMs });
        lastQueuedSourceAt = capturedAt;
      }
      if (queue.length > 9) queue.splice(0, queue.length - 9);
      publish();
    }
    drain();
  }
  function failWorker(error: Error) {
    rejectPreparation?.(error); resolvePreparation = null; rejectPreparation = null;
    preparation = null; modelReady = false; worker?.terminate(); worker = null; inFlightId = null;
    stop(); state.phase = 'error'; state.error = error.message; publish();
  }
  function prepare(): Promise<void> {
    if (disposed) return Promise.reject(new Error('speech_controller_disposed'));
    if (modelReady) return Promise.resolve();
    if (preparation) return preparation;
    state.phase = 'loading'; state.error = null; publish();
    preparation = new Promise<void>((resolve, reject) => { resolvePreparation = resolve; rejectPreparation = reject; });
    const result = preparation;
    try {
      worker = new Worker(options.workerUrl ?? SPEECH_WORKER_URL, { type: 'module', name: 'avatar-wav2arkit' });
      worker.onmessage = onWorkerMessage;
      worker.onerror = event => failWorker(new Error(event.message || 'speech_worker_failed'));
      worker.onmessageerror = () => failWorker(new Error('speech_worker_message_failed'));
      const request: SpeechWorkerRequest = { type: 'prepare', configuration }; worker.postMessage(request);
    } catch (error) { failWorker(error instanceof Error ? error : new Error(String(error))); }
    return result;
  }
  function captureChunk(samples: Float32Array, sampleRate: number, token: number) {
    if (disposed || token !== generation || state.phase !== 'listening') return;
    const mono = resampleMono(samples, sampleRate), timestamp = now();
    if (!Number.isFinite(audioStartedAt)) audioStartedAt = timestamp - mono.length / 16000 * 1000;
    options.onAudioChunk?.(mono.slice(), 16000, timestamp);
    const level = rms(mono);
    state.level = Math.min(1, level * 6);
    const heardSpeech = level > noiseGate;
    if (heardSpeech) { silentChunks = 0; state.speaking = true; }
    else silentChunks++;
    if (!state.speaking || silentChunks >= 2) {
      state.speaking = false;
      silenceAt = timestamp; pending = null; queue = []; recent = new Float32Array(0);
      audioStartedAt = Infinity; lastQueuedSourceAt = -Infinity;
      clearFrame(); publish(); return;
    }
    // The first silent hop is real future context for the preceding voiced
    // tail. Skipping it would cut the final syllable from the interior output.
    recent = appendRecent(recent, mono, contextSamples);
    if (pending) state.droppedChunks++;
    pending = { samples: padAudioContext(recent, contextSamples), capturedAt: timestamp, generation: token };
    drain(); publish();
  }
  function stop() {
    generation++; pending = null; queue = []; recent = new Float32Array(0); silentChunks = 0; silenceAt = now();
    audioStartedAt = Infinity; lastQueuedSourceAt = -Infinity;
    if (paceTimer) clearInterval(paceTimer); paceTimer = null;
    if (capture) { capture.port.onmessage = null; capture.disconnect(); capture = null; }
    source?.disconnect(); source = null; mute?.disconnect(); mute = null;
    if (stream) { for (const track of stream.getTracks()) { track.onended = null; track.stop(); } stream = null; }
    if (context) { void context.close().catch(() => {}); context = null; }
    state.level = 0; state.speaking = false;
    if (!disposed) state.phase = modelReady ? 'ready' : 'idle';
    clearFrame(); publish();
  }
  async function start(startOptions: { deviceId?: string } = {}) {
    if (disposed) throw new Error('speech_controller_disposed');
    stop(); const token = generation;
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error('microphone_requires_secure_origin'); state.phase = 'error'; state.error = error.message; publish(); throw error;
    }
    state.phase = 'requesting'; state.error = null; publish();
    let requestedStream: MediaStream | null = null;
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        ...(startOptions.deviceId ? { deviceId: { exact: startOptions.deviceId } } : {}),
      }, video: false });
      if (disposed || token !== generation) { requestedStream.getTracks().forEach(track => track.stop()); return; }
      stream = requestedStream; requestedStream = null;
      state.deviceId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? startOptions.deviceId ?? '';
      await prepare();
      if (disposed || token !== generation || !stream) return;
      try { context = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' }); }
      catch { context = new AudioContext({ latencyHint: 'interactive' }); }
      const ownContext = context;
      await ownContext.resume();
      await ownContext.audioWorklet.addModule(options.captureWorkletUrl ?? SPEECH_CAPTURE_WORKLET_URL);
      if (disposed || token !== generation || !stream || context !== ownContext) return;
      source = ownContext.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(ownContext, 'avatar-speech-capture', { numberOfInputs: 1, numberOfOutputs: 1,
        channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      mute = ownContext.createGain(); mute.gain.value = 0;
      capture.port.onmessage = (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => captureChunk(event.data.samples, event.data.sampleRate, token);
      source.connect(capture); capture.connect(mute); mute.connect(ownContext.destination);
      stream.getAudioTracks().forEach(track => { track.onended = () => stop(); });
      state.phase = 'listening'; publish();
      paceTimer = setInterval(() => {
        const next = queue.shift();
        if (!next || disposed || state.phase !== 'listening') return;
        if (now() - next.capturedAt >= 900) { state.droppedChunks++; return; }
        const timestamp = now(); state.frames++; state.latencyMs = Math.max(0, timestamp - next.capturedAt);
        options.onFrame({ ...next, timestamp, latencyMs: state.latencyMs, speaking: true });
      }, 1000 / 30);
    } catch (error) {
      requestedStream?.getTracks().forEach(track => track.stop());
      if (disposed || token !== generation) return;
      stop(); state.phase = 'error'; state.error = error instanceof Error ? error.message : String(error); publish(); throw error;
    }
  }
  return {
    prepare, start, stop,
    dispose() {
      if (disposed) return;
      stop(); disposed = true;
      rejectPreparation?.(new Error('speech_controller_disposed')); rejectPreparation = null; resolvePreparation = null;
      worker?.terminate(); worker = null; state.phase = 'disposed'; publish();
    },
    async listDevices() { return (await navigator.mediaDevices?.enumerateDevices() ?? []).filter(device => device.kind === 'audioinput'); },
    setNoiseGate(value) { if (Number.isFinite(value)) noiseGate = Math.max(0, Math.min(0.1, value)); },
    getStatus() { return { ...state }; },
  };
}
