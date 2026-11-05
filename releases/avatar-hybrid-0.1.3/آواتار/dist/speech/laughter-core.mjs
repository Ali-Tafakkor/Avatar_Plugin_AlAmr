/** YAMNet AudioSet class indices from TensorFlow's yamnet_class_map.csv.
 * These identify an audible event; they do not identify a person's emotions.
 * Baby laughter is omitted from the adult-avatar trigger, while its general
 * Laughter parent remains usable. See THIRD_PARTY_NOTICES.md for provenance. */
export const LAUGHTER_CLASS_INDICES = Object.freeze([13, 15, 16, 17, 18]);
export const LAUGHTER_CLASS_NAMES = Object.freeze(['Laughter', 'Giggle', 'Snicker', 'Belly laugh', 'Chuckle, chortle']);
const SPEECH_INDICES = [0, 1, 2, 3, 5];
const finite01 = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export function summarizeLaughterScores(scores) {
  let rawScore = 0, label = 'Laughter', topScore = 0;
  for (let i = 0; i < scores.length; i++) topScore = Math.max(topScore, finite01(scores[i]));
  for (let i = 0; i < LAUGHTER_CLASS_INDICES.length; i++) {
    const score = finite01(scores[LAUGHTER_CLASS_INDICES[i]]);
    if (score > rawScore) { rawScore = score; label = LAUGHTER_CLASS_NAMES[i]; }
  }
  const speechScore = Math.max(0, ...SPEECH_INDICES.map(i => finite01(scores[i])));
  return { rawScore, speechScore, topScore, label };
}

/** Conservative confidence gate: two positive overlapping windows, or one
 * strong/dominant laughter event. The thresholds are prototype calibration values,
 * not measured accuracy. The avatar compositor performs the visual smoothing. */
export class LaughterConfidenceGate {
  constructor({ enterThreshold = 0.25, exitThreshold = 0.12, strongThreshold = 0.65, staleMs = 1500 } = {}) {
    this.enterThreshold = finite01(enterThreshold);
    this.exitThreshold = Math.min(this.enterThreshold, finite01(exitThreshold));
    this.strongThreshold = Math.max(this.enterThreshold, finite01(strongThreshold));
    this.staleMs = staleMs;
    this.reset();
  }
  reset() { this.active = false; this.positiveWindows = 0; this.lastAt = -Infinity; this.score = 0; }
  update(scores, at) {
    const summary = summarizeLaughterScores(scores);
    if (!Number.isFinite(at) || at < this.lastAt) return { ...summary, active: this.active, score: this.score };
    if (at - this.lastAt > this.staleMs) { this.active = false; this.positiveWindows = 0; }
    this.lastAt = at;
    const { rawScore, topScore } = summary;
    // A tiny secondary score behind an unrelated dominant event does not
    // animate a smile. Speech may coexist with laughter, so no speech veto.
    const eligible = rawScore >= this.enterThreshold && rawScore >= topScore * 0.35;
    this.positiveWindows = eligible ? this.positiveWindows + 1 : 0;
    const dominant = eligible && rawScore >= topScore * 0.85;
    if (!this.active && (rawScore >= this.strongThreshold || dominant || this.positiveWindows >= 2)) this.active = true;
    if (this.active && rawScore < this.exitThreshold) this.active = false;
    this.score = this.active ? Math.min(1, rawScore / 0.85) : 0;
    return { ...summary, active: this.active, score: this.score };
  }
}
