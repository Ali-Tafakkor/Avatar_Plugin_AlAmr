export type SpeechFrameOptions = { at?: number; speaking?: boolean; laughter?: number };
export type SpeechOptions = { enabled?: boolean; gain?: number; laughterEnabled?: boolean; staleAfterMs?: number };
export type SpeechStatus = { enabled: boolean; active: boolean; speaking: boolean; mix: number; gain: number;
  laughter: number; laughterEnabled: boolean; frames: number; frameAgeMs: number | null };
export const SPEECH_CHANNELS: readonly string[];
export class SpeechCompositor {
  constructor(options?: SpeechOptions & { clock?: () => number });
  setOptions(options: SpeechOptions): void;
  setFrame(weights: Record<string, number> | null, options?: SpeechFrameOptions): void;
  setLaughter(score: number, options?: { at?: number }): void;
  clear(): void;
  compose(base: Record<string, number>, delta: number): Record<string, number>;
  getStatus(): SpeechStatus;
}
