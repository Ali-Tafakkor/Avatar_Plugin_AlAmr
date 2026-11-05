export const LAUGHTER_CLASS_INDICES: readonly number[];
export const LAUGHTER_CLASS_NAMES: readonly string[];
export interface LaughterSummary { rawScore: number; speechScore: number; topScore: number; label: string }
export interface LaughterGateResult extends LaughterSummary { active: boolean; score: number }
export function summarizeLaughterScores(scores: ArrayLike<number>): LaughterSummary;
export class LaughterConfidenceGate {
  constructor(options?: { enterThreshold?: number; exitThreshold?: number; strongThreshold?: number; staleMs?: number });
  active: boolean; score: number;
  reset(): void;
  update(scores: ArrayLike<number>, at: number): LaughterGateResult;
}
