export interface SpeechModelConfiguration {
  modelBaseUrl: string;
  wasmBaseUrl: string;
  modelFile: string;
  modelParts?: { file: string; bytes: number }[];
  /** null means the graph embeds its tensors, e.g. a single-file int8 export. */
  dataFile: string | null;
  /** Byte-exact tensor data split into ordinary model assets for bundle limits. */
  dataParts?: { file: string; bytes: number }[];
}

export type SpeechWorkerRequest =
  | { type: 'prepare'; configuration: SpeechModelConfiguration }
  | { type: 'infer'; id: number; generation: number; samples: Float32Array; tailFrames: number; lookaheadFrames: number; capturedAt: number };

export type SpeechWorkerResponse =
  | { type: 'progress'; loaded: number; total: number; phase: 'download' | 'initializing' | 'warmup' }
  | { type: 'ready'; warmupMs: number }
  | { type: 'result'; id: number; generation: number; capturedAt: number; inferenceMs: number; frames: Float32Array[]; frameStartOffsetMs: number; frameIntervalMs: number }
  | { type: 'error'; message: string; id?: number; generation?: number };
