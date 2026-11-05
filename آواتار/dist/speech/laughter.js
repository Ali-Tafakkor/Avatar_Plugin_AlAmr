import { LaughterConfidenceGate } from './laughter-core.mjs';
export const DEFAULT_LAUGHTER_WORKER_URL = new URL('../assets/speech/workers/laughter.worker.js', import.meta.url).href;
// Exactly one complete YAMNet patch: .96s + .025s STFT window - .010s hop.
// A full1s waveform generates a second, partly zero-padded patch and dilutes
// brief laugh scores if both are averaged.15600samples avoids that extra row.
const SAMPLE_RATE = 16000, WINDOW_SAMPLES = 15600, HOP_MS = 480;
/** Local AudioSet laughter-event detection, independent of phoneme animation.
 * The host feeds the same captured mono PCM as the speech engine. There is no
 * microphone capture, recording, transcript, upload, or emotion inference here.
 * Performance and thresholds still require validation with the user's mic. */
export class LaughterDetector {
    options;
    gate;
    worker = null;
    ring = new Float32Array(WINDOW_SAMPLES);
    written = 0;
    cursor = 0;
    lastSentAt = -Infinity;
    lastInputAt = -Infinity;
    silentMs = 0;
    lastSilenceAt = -Infinity;
    busy = false;
    ready = false;
    pending = null;
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
    error = null;
    startTimer = null;
    constructor(options) {
        this.options = options;
        this.gate = new LaughterConfidenceGate({ enterThreshold: options.enterThreshold });
    }
    start() {
        if (this.startPromise)
            return this.startPromise;
        this.error = null;
        this.ring.fill(0);
        this.written = 0;
        this.cursor = 0;
        this.silentMs = 0;
        this.lastSentAt = -Infinity;
        this.lastInputAt = -Infinity;
        this.lastSilenceAt = -Infinity;
        this.options.onStatus?.({ state: 'loading' });
        const started = new Promise((resolve, reject) => { this.resolveStart = resolve; this.rejectStart = reject; });
        this.startPromise = started;
        try {
            const worker = new Worker(this.options.workerUrl ?? DEFAULT_LAUGHTER_WORKER_URL, { type: 'module', name: 'avatar-laughter' });
            this.worker = worker;
            worker.onmessage = event => { if (this.worker === worker)
                this.receive(event.data); };
            worker.onerror = event => { if (this.worker === worker)
                this.fail(event.message || 'yamnet_worker_failed'); };
            this.startTimer = setTimeout(() => this.fail('yamnet_initialization_timeout'), 120000);
            const base = new URL(this.options.wasmBaseUrl, document.baseURI).href;
            worker.postMessage({ type: 'init', modelUrl: new URL(this.options.modelUrl, document.baseURI).href,
                wasmBaseUrl: base.endsWith('/') ? base : base + '/' });
        }
        catch (error) {
            this.fail(error instanceof Error ? error.message : String(error));
        }
        return started;
    }
    /** Monotonic chunk-end timestamp from performance.now(); expects 16kHz mono. */
    pushAudio(samples, sampleRate = SAMPLE_RATE, at = performance.now()) {
        if (!this.worker || this.error || sampleRate !== SAMPLE_RATE || !samples.length || !Number.isFinite(at) || at < this.lastInputAt)
            return;
        this.lastInputAt = at;
        let energy = 0;
        for (let i = 0; i < samples.length; i++) {
            const value = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0;
            this.ring[this.cursor] = value;
            this.cursor = (this.cursor + 1) % WINDOW_SAMPLES;
            this.written = Math.min(WINDOW_SAMPLES, this.written + 1);
            energy += value * value;
        }
        const rms = Math.sqrt(energy / samples.length);
        this.silentMs = rms < 0.003 ? this.silentMs + samples.length / SAMPLE_RATE * 1000 : 0;
        if (this.silentMs >= 400) {
            this.lastSilenceAt = at;
            this.pending = null;
            // A new utterance must not classify the preceding laugh again through
            // an old rolling window, even when the new job itself has a fresh at.
            this.ring.fill(0);
            this.written = 0;
            this.cursor = 0;
            this.lastSentAt = -Infinity;
            this.gate.reset();
            this.publishZero(at);
            return;
        }
        if (this.written < WINDOW_SAMPLES || at - this.lastSentAt < HOP_MS)
            return;
        const audio = new Float32Array(WINDOW_SAMPLES);
        audio.set(this.ring.subarray(this.cursor));
        audio.set(this.ring.subarray(0, this.cursor), WINDOW_SAMPLES - this.cursor);
        this.pending = { audio, at };
        this.lastSentAt = at;
        this.flush();
    }
    flush() {
        if (!this.worker || !this.ready || this.busy || !this.pending)
            return;
        const pending = this.pending;
        this.pending = null;
        this.busy = true;
        this.worker.postMessage({ type: 'infer', ...pending }, [pending.audio.buffer]);
    }
    receive(message) {
        if (message.type === 'ready') {
            this.ready = true;
            if (this.startTimer)
                clearTimeout(this.startTimer);
            this.startTimer = null;
            this.resolveStart?.();
            this.resolveStart = null;
            this.rejectStart = null;
            this.options.onStatus?.({ state: 'ready' });
            this.flush();
        }
        else if (message.type === 'result') {
            this.busy = false;
            const at = message.at ?? -Infinity;
            if (message.scores && at > this.lastSilenceAt && this.lastInputAt - at <= 1200 && performance.now() - at <= 1200) {
                this.options.onScore({ ...this.gate.update(message.scores, at), at, inferenceMs: message.inferenceMs ?? 0 });
            }
            this.flush();
        }
        else if (message.type === 'error')
            this.fail(message.message || 'yamnet_inference_failed');
    }
    publishZero(at) {
        this.options.onScore({ score: 0, rawScore: 0, speechScore: 0, topScore: 0, label: 'Laughter', active: false, at, inferenceMs: 0 });
    }
    fail(error) {
        this.error = error;
        if (this.startTimer)
            clearTimeout(this.startTimer);
        this.startTimer = null;
        this.worker?.terminate();
        this.worker = null;
        this.ready = false;
        this.busy = false;
        this.pending = null;
        this.rejectStart?.(new Error(error));
        this.resolveStart = null;
        this.rejectStart = null;
        this.startPromise = null;
        this.gate.reset();
        this.publishZero(performance.now());
        this.options.onStatus?.({ state: 'error', error });
    }
    stop() {
        if (this.startTimer)
            clearTimeout(this.startTimer);
        this.startTimer = null;
        this.worker?.terminate();
        this.worker = null;
        this.rejectStart?.(new Error('yamnet_start_cancelled'));
        this.resolveStart = null;
        this.rejectStart = null;
        this.startPromise = null;
        this.ready = false;
        this.busy = false;
        this.pending = null;
        this.ring.fill(0);
        this.written = 0;
        this.cursor = 0;
        this.silentMs = 0;
        this.lastSentAt = -Infinity;
        this.lastInputAt = -Infinity;
        this.lastSilenceAt = -Infinity;
        this.gate.reset();
        this.publishZero(performance.now());
        this.options.onStatus?.({ state: 'stopped' });
    }
    dispose() { this.stop(); }
}
//# sourceMappingURL=laughter.js.map