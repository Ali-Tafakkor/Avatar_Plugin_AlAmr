import { clamp, damp, seededRandom } from './math.mjs';

const pair = (name, value) => ({ [name + 'Left']: value, [name + 'Right']: value });
export const EMOTIONS = Object.freeze({
  neutral: { label: 'خنثی', key: '0', icon: 'neutral', values: {} },
  smile: { label: 'لبخند آرام', key: '1', icon: 'smile', values: { ...pair('mouthSmile', 0.24), ...pair('cheekSquint', 0.10), ...pair('eyeSquint', 0.05) } },
  laugh: { label: 'خنده', key: '2', icon: 'laugh', values: { ...pair('mouthSmile', 0.82), ...pair('cheekSquint', 0.40), ...pair('eyeSquint', 0.33), ...pair('mouthUpperUp', 0.15), ...pair('mouthLowerDown', 0.12), jawOpen: 0.30 } },
  sad: { label: 'ناراحتی', key: '3', icon: 'sad', values: { browInnerUp: 0.70, ...pair('browDown', 0.18), ...pair('mouthFrown', 0.72), mouthShrugLower: 0.10, ...pair('eyeSquint', 0.11), mouthPressLeft: 0.12, mouthPressRight: 0.15 } },
  angry: { label: 'عصبانیت', key: '4', icon: 'angry', values: { ...pair('browDown', 0.84), ...pair('eyeSquint', 0.28), ...pair('noseSneer', 0.28), ...pair('mouthPress', 0.36), jawForward: 0.10, jawOpen: 0.035, ...pair('mouthFrown', 0.12) } },
  surprise: { label: 'تعجب', key: '5', icon: 'surprise', values: { browInnerUp: 0.78, ...pair('browOuterUp', 0.83), ...pair('eyeWide', 0.80), jawOpen: 0.52, mouthFunnel: 0.17, ...pair('mouthLowerDown', 0.10) } }
});

export const FACE_GROUPS = Object.freeze({
  jaw: ['jawOpen'], smile: ['mouthSmileLeft', 'mouthSmileRight'],
  frown: ['mouthFrownLeft', 'mouthFrownRight'], brows: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'],
  browDown: ['browDownLeft', 'browDownRight'], wide: ['eyeWideLeft', 'eyeWideRight']
});
export function normalizeShape(s) {
  return s.replace(/^.*(?:blendshape[.:]|blendshapes[.:])/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/** All animation layers produce weights, never replace the face with a texture or an emoji. */
export class ExpressionState {
  constructor() {
    this.name = 'smile'; this.intensity = 0.88; this.transition = 7.5;
    this.blinkEnabled = true; this.gazeEnabled = true; this.microEnabled = true;
    this.time = 0; this.random = seededRandom(1952); this.blinkAt = 2.4; this.blinkT = -1;
    this.weights = {}; this.manual = {}; this.gaze = { x: 0, y: 0 }; this.saccadeAt = 0;
    this.saccade = { x: 0, y: 0 };
  }
  setEmotion(name) { if (EMOTIONS[name]) { this.name = name; this.manual = {}; } }
  setManual(group, amount) {
    for (const name of FACE_GROUPS[group] || []) this.manual[name] = clamp(amount, 0, 1);
  }
  blink() { this.blinkT = 0; }
  update(dt, look = { x: 0, y: 0 }) {
    this.time += dt;
    const desired = {};
    for (const [name, weight] of Object.entries(EMOTIONS[this.name].values)) desired[name] = weight * this.intensity;
    if (this.microEnabled && this.name === 'laugh') {
      desired.jawOpen *= 0.75 + 0.25 * Math.sin(this.time * 9.5) ** 2;
      desired.mouthSmileLeft *= 0.95 + 0.05 * Math.sin(this.time * 3.2);
    }
    Object.assign(desired, this.manual);
    if (this.time >= this.blinkAt && this.blinkEnabled && this.blinkT < 0) this.blink();
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT < 0.070) blink = this.blinkT / 0.070;
      else if (this.blinkT < 0.103) blink = 1;
      else if (this.blinkT < 0.240) blink = 1 - (this.blinkT - 0.103) / 0.137;
      else { this.blinkT = -1; this.blinkAt = this.time + (this.random() < 0.12 ? 0.18 : 2.4 + this.random() * 3.1); }
    }
    desired.eyeBlinkLeft = clamp(blink, 0, 1); desired.eyeBlinkRight = clamp(blink * 0.98, 0, 1);
    // Avoid contradictory eye-wide and eye-close instructions in the same frame.
    desired.eyeWideLeft = (desired.eyeWideLeft || 0) * (1 - blink);
    desired.eyeWideRight = (desired.eyeWideRight || 0) * (1 - blink);
    if (this.time > this.saccadeAt) {
      this.saccade = { x: (this.random() - 0.5) * 0.085, y: (this.random() - 0.5) * 0.045 };
      this.saccadeAt = this.time + 0.8 + this.random() * 2.1;
    }
    this.gaze.x = damp(this.gaze.x, this.gazeEnabled ? look.x + (this.microEnabled ? this.saccade.x : 0) : 0, 14, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeEnabled ? look.y + (this.microEnabled ? this.saccade.y : 0) : 0, 14, dt);
    const x = clamp(this.gaze.x, -0.5, 0.5), y = clamp(this.gaze.y, -0.4, 0.4);
    desired.eyeLookOutLeft = desired.eyeLookInRight = Math.max(0, x);
    desired.eyeLookInLeft = desired.eyeLookOutRight = Math.max(0, -x);
    desired.eyeLookUpLeft = desired.eyeLookUpRight = Math.max(0, y);
    desired.eyeLookDownLeft = desired.eyeLookDownRight = Math.max(0, -y);
    for (const name of new Set([...Object.keys(this.weights), ...Object.keys(desired)])) {
      const target = clamp(desired[name] || 0, 0, 1);
      this.weights[name] = name.startsWith('eyeBlink') ? target : damp(this.weights[name] || 0, target, this.transition, dt);
      if (Math.abs(this.weights[name]) < 1e-5) this.weights[name] = 0;
    }
    return this.weights;
  }
}

export class FaceRig {
  constructor(root) {
    this.bindings = []; this.shapes = new Set(); this.byNormalizedName = new Map();
    root.traverse(node => {
      if (!node.morphTargetDictionary || !node.morphTargetInfluences) return;
      for (const [name, index] of Object.entries(node.morphTargetDictionary)) {
        const normalized = normalizeShape(name);
        this.bindings.push({ node, index, normalized });
        this.shapes.add(name); this.byNormalizedName.set(normalized, name);
      }
    });
    this.essential = ['jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'browInnerUp', 'browDownLeft', 'eyeBlinkLeft', 'eyeWideLeft'];
    this.missing = this.essential.filter(name => !this.byNormalizedName.has(normalizeShape(name)));
  }
  apply(weights) {
    const normalized = new Map(Object.entries(weights).map(([name, value]) => [normalizeShape(name), value]));
    for (const { node, index, normalized: name } of this.bindings) node.morphTargetInfluences[index] = normalized.get(name) || 0;
  }
}
