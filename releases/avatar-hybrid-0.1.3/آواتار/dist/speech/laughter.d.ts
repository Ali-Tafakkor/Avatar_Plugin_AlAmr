import { type LaughterGateResult } from './laughter-core.mjs';
export interface LaughterResult extends LaughterGateResult {
    at: number;
    inferenceMs: number;
}
export type LaughterStatus = {
    state: 'idle' | 'loading' | 'ready' | 'stopped' | 'error';
    error?: string;
    inferenceMs?: number;
};
export interface LaughterDetectorOptions {
    /** Local, pinned YAMNet ONNX file. No microphone audio is sent here. */
    modelUrl: string;
    /** Local directory containing the exact ORT WASM/glue version. */
    wasmBaseUrl: string;
    /** Explicit bundled worker URL supplied by the host. */
    workerUrl?: string;
    onScore: (result: LaughterResult) => void;
    onStatus?: (status: LaughterStatus) => void;
    enterThreshold?: number;
}
export declare const DEFAULT_LAUGHTER_WORKER_URL: string;
/** Local AudioSet laughter-event detection, independent of phoneme animation.
 * The host feeds the same captured mono PCM as the speech engine. There is no
 * microphone capture, recording, transcript, upload, or emotion inference here.
 * Performance and thresholds still require validation with the user's mic. */
export declare class LaughterDetector {
    private readonly options;
    private readonly gate;
    private worker;
    private ring;
    private written;
    private cursor;
    private lastSentAt;
    private lastInputAt;
    private silentMs;
    private lastSilenceAt;
    private busy;
    private ready;
    private pending;
    private resolveStart;
    private rejectStart;
    private startPromise;
    private error;
    private startTimer;
    constructor(options: LaughterDetectorOptions);
    start(): Promise<void>;
    /** Monotonic chunk-end timestamp from performance.now(); expects 16kHz mono. */
    pushAudio(samples: Float32Array, sampleRate?: number, at?: number): void;
    private flush;
    private receive;
    private publishZero;
    private fail;
    stop(): void;
    dispose(): void;
}
