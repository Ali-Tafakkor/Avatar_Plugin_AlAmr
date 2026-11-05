/**
 * Single-writer composition for Hybrid speech. Canonical names resolve through
 * the native FaceRig; no speech code writes morphTargetInfluences directly.
 * These conservative GLB gains are local calibration defaults, not the
 * Gaussian renderer's asset-specific gain/neutral smile.
 */
const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : 0));
const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
const clock = () => globalThis.performance?.now?.() ?? Date.now();

const CALIBRATION = Object.freeze({
  jawOpen: [2.8, 0.58], jawForward: [1.5, 0.25], jawLeft: [1.2, 0.25], jawRight: [1.2, 0.25],
  mouthClose: [1.8, 0.85], mouthFunnel: [1.8, 0.62], mouthPucker: [1.8, 0.62],
  mouthLeft: [1.2, 0.30], mouthRight: [1.2, 0.30],
  mouthDimpleLeft: [1.0, 0.30], mouthDimpleRight: [1.0, 0.30],
  mouthFrownLeft: [0.8, 0.35], mouthFrownRight: [0.8, 0.35],
  mouthLowerDownLeft: [1.7, 0.42], mouthLowerDownRight: [1.7, 0.42],
  mouthPressLeft: [1.5, 0.60], mouthPressRight: [1.5, 0.60],
  mouthRollLower: [1.2, 0.45], mouthRollUpper: [1.2, 0.45],
  mouthShrugLower: [1.0, 0.35], mouthShrugUpper: [1.0, 0.35],
  mouthSmileLeft: [0.65, 0.42], mouthSmileRight: [0.65, 0.42],
  mouthStretchLeft: [1.2, 0.40], mouthStretchRight: [1.2, 0.40],
  mouthUpperUpLeft: [1.7, 0.45], mouthUpperUpRight: [1.7, 0.45],
});
export const SPEECH_CHANNELS = Object.freeze(Object.keys(CALIBRATION));
const EMOTION_MOUTH = new Set(['mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight']);

export class SpeechCompositor {
  constructor(options = {}) {
    this.clock = options.clock ?? clock;
    this.options = { enabled: true, gain: 1, laughterEnabled: true, staleAfterMs: 650 };
    this.frame = {}; this.smoothed = {}; this.mix = 0; this.speaking = false;
    this.lastFrameAt = -Infinity; this.lastLaughterAt = -Infinity;
    this.laughterTarget = 0; this.laughter = 0; this.receivedFrames = 0;
    this.setOptions(options);
  }
  setOptions(options = {}) {
    for (const name of ['enabled', 'laughterEnabled']) {
      if (typeof options[name] === 'boolean') this.options[name] = options[name];
    }
    if (Number.isFinite(options.gain)) this.options.gain = clamp(options.gain, 0, 3);
    if (Number.isFinite(options.staleAfterMs)) this.options.staleAfterMs = clamp(options.staleAfterMs, 150, 2000);
  }
  setFrame(weights, options = {}) {
    if (weights === null) { this.clear(); return; }
    const now = this.clock();
    const at = Number.isFinite(options.at) ? Math.min(now, options.at) : now;
    // A late worker result cannot revive an older utterance after silence.
    if (at < this.lastFrameAt) return;
    this.lastFrameAt = at;
    this.frame = {};
    for (const name of SPEECH_CHANNELS) this.frame[name] = clamp(weights?.[name]);
    this.speaking = options.speaking !== false;
    this.receivedFrames++;
    if (Number.isFinite(options.laughter)) this.setLaughter(options.laughter, { at });
  }
  setLaughter(score, options = {}) {
    const now = this.clock();
    const at = Number.isFinite(options.at) ? Math.min(now, options.at) : now;
    if (at < this.lastLaughterAt) return;
    this.lastLaughterAt = at; this.laughterTarget = clamp(score);
  }
  clear() {
    this.frame = {}; this.smoothed = {}; this.mix = 0; this.speaking = false;
    this.lastFrameAt = -Infinity; this.lastLaughterAt = -Infinity;
    this.laughterTarget = 0; this.laughter = 0;
  }
  compose(base, delta) {
    const dt = clamp(delta, 0, 0.1), now = this.clock();
    const live = this.options.enabled && this.speaking && now - this.lastFrameAt <= this.options.staleAfterMs;
    this.mix = damp(this.mix, live ? 1 : 0, live ? 28 : 16, dt);
    const laughTarget = this.options.enabled && this.options.laughterEnabled && now - this.lastLaughterAt < 1100
      ? this.laughterTarget : 0;
    this.laughter = damp(this.laughter, laughTarget, laughTarget > this.laughter ? 8 : 4.5, dt);
    if (this.mix < 0.00001) this.mix = 0;
    if (this.laughter < 0.00001) this.laughter = 0;
    // Preserve exactly the accepted baseline when no voice layer is present.
    if (!this.mix && !this.laughter) return { ...base };

    const result = { ...base };
    if (this.mix) {
      for (const name of SPEECH_CHANNELS) {
        const [gain, maximum] = CALIBRATION[name];
        const target = live ? clamp(this.frame[name] * gain * this.options.gain, 0, maximum) : 0;
        this.smoothed[name] = damp(this.smoothed[name] ?? 0, target, 38, dt);
        const mood = clamp(base[name]);
        // Keep the mood's mouth corners, while speech owns articulation/jaw.
        const spoken = EMOTION_MOUTH.has(name) ? clamp(this.smoothed[name] + mood * 0.65) : this.smoothed[name];
        result[name] = clamp(mood + (spoken - mood) * this.mix);
      }
      const closure = clamp(result.mouthClose);
      result.jawOpen *= 1 - closure * 0.88;
      const opening = clamp(result.jawOpen / 0.58);
      for (const name of ['mouthPressLeft', 'mouthPressRight']) result[name] *= 1 - opening * 0.55;
    }
    if (this.laughter) {
      // Audible laughter adds a smile/cheeks, never a fabricated jaw waveform.
      for (const side of ['Left', 'Right']) {
        result['mouthSmile' + side] = Math.max(result['mouthSmile' + side] ?? 0, this.laughter * 0.58);
        result['cheekSquint' + side] = Math.max(result['cheekSquint' + side] ?? 0, this.laughter * 0.28);
        result['eyeSquint' + side] = Math.max(result['eyeSquint' + side] ?? 0, this.laughter * 0.16);
        result['browOuterUp' + side] = clamp((result['browOuterUp' + side] ?? 0) + this.laughter * 0.035);
        result['mouthFrown' + side] = (result['mouthFrown' + side] ?? 0) * (1 - this.laughter * 0.8);
      }
    }
    // Keep rounded phonemes readable even while the cheeks retain a smile.
    const rounded = Math.max(result.mouthFunnel ?? 0, result.mouthPucker ?? 0) * this.mix;
    for (const name of ['mouthSmileLeft', 'mouthSmileRight', 'mouthDimpleLeft', 'mouthDimpleRight']) {
      if (Object.hasOwn(result, name)) result[name] *= 1 - rounded * 0.65;
    }
    // Speech cannot override eyes/gaze. Enforce full closure during a blink.
    for (const side of ['Left', 'Right']) {
      if (Object.hasOwn(result, 'eyeWide' + side)) result['eyeWide' + side] *= 1 - clamp(result['eyeBlink' + side]);
    }
    return result;
  }
  getStatus() {
    const now = this.clock();
    return { enabled: this.options.enabled, active: this.mix > 0.001, speaking: this.options.enabled && this.speaking &&
      now - this.lastFrameAt <= this.options.staleAfterMs, mix: this.mix, gain: this.options.gain,
      laughter: this.laughter, laughterEnabled: this.options.laughterEnabled, frames: this.receivedFrames,
      frameAgeMs: Number.isFinite(this.lastFrameAt) ? Math.max(0, now - this.lastFrameAt) : null };
  }
}
