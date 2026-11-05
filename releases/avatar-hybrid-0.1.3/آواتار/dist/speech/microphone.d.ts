import { type SpeechWeights } from './arkit.js';
export declare const SPEECH_WORKER_URL: string;
export declare const SPEECH_CAPTURE_WORKLET_URL: string;
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
    modelParts?: {
        file: string;
        bytes: number;
    }[];
    dataFile?: string | null;
    dataParts?: {
        file: string;
        bytes: number;
    }[];
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
    start(options?: {
        deviceId?: string;
    }): Promise<void>;
    stop(): void;
    dispose(): void;
    listDevices(): Promise<MediaDeviceInfo[]>;
    setNoiseGate(value: number): void;
    getStatus(): MicrophoneSpeechStatus;
}
/** Owns only its microphone/audio graph and worker, never the avatar RAF or renderer. */
export declare function createMicrophoneSpeechController(options: MicrophoneSpeechOptions): MicrophoneSpeechController;
