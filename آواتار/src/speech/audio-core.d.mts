export function rms(samples: Float32Array): number;
export function resampleMono(samples: Float32Array, sourceRate: number, targetRate?: number): Float32Array;
export function appendRecent(previous: Float32Array, current: Float32Array, maximumSamples: number): Float32Array;
export function padAudioContext(samples: Float32Array, minimumSamples: number): Float32Array;
export function selectSpeechInterval(data: Float32Array, frameCount: number, sampleCount: number, tailFrames: number, lookaheadFrames?: number, fps?: number, rate?: number): { frames: Float32Array[]; frameStartOffsetMs: number; frameIntervalMs: number };
