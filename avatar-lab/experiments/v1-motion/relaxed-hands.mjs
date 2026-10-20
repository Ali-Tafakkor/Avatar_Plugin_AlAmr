import { Quaternion, Vector3 } from 'three';

const DIGITS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const PROFILE = Object.freeze({
  // Anatomical abduction and cumulative MCP/PIP/DIP flexion, in degrees.
  thumb: { spread: 28, curl: [8, 20, 30] },
  index: { spread: 3, curl: [14, 38, 50] },
  middle: { spread: 0, curl: [18, 45, 58] },
  ring: { spread: -2, curl: [22, 51, 65] },
  pinky: { spread: -4, curl: [26, 55, 70] },
});
const V = () => new Vector3(), Q = () => new Quaternion();
const radians = value => value * Math.PI / 180;
const clampWeight = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** An overridable local pose layer, applied AFTER raw V1 retargeting.
 * It owns only finger joints while Stand/Walk/Run are active. No wrist, arm,
 * face, source model or original animation track is changed. HandRaise and the
 * original V2 airborne/landing pose are excluded without a residual fade.
 */
export function createRelaxedHands(actor) {
  const targets = [], calibration = [];
  const saved = [...actor.bones.values()].map(bone => ({ bone, p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }));
  const required = name => {
    const bone = actor.bones.get(name);
    if (!bone || !actor.rest.has(bone.uuid)) throw new Error('relaxed_hands_missing_' + name);
    return bone;
  };
  try {
    actor.restore();
    for (const side of ['left', 'right']) {
      const hand = required(side + 'hand'), handQ = hand.getWorldQuaternion(Q()), inverseHandQ = handQ.clone().invert();
      const handPosition = hand.getWorldPosition(V());
      const point = bone => bone.getWorldPosition(V()).sub(handPosition).applyQuaternion(inverseHandQ);
      const chains = Object.fromEntries(DIGITS.map(digit => [digit, [1, 2, 3, 4].map(index => required(side + 'hand' + digit + index))]));
      const forward = point(chains.middle[0]).normalize();
      const radial = point(chains.index[0]).sub(point(chains.pinky[0]));
      radial.addScaledVector(forward, -radial.dot(forward)).normalize();
      if (radial.lengthSq() < 0.9 || forward.lengthSq() < 0.9) throw new Error('relaxed_hands_degenerate_palm_' + side);
      const palm = forward.clone().cross(radial).normalize();
      // Determine the flexion side from the model's existing PIP/DIP curvature.
      // The mirrored hands consequently use their own anatomical axes, never
      // an identical Euler rotation copied onto left and right joints.
      let restCurl = 0;
      for (const digit of DIGITS.slice(1)) {
        const chain = chains[digit], proximal = point(chain[1]).sub(point(chain[0])).normalize();
        const distal = point(chain[3]).sub(point(chain[2])).normalize();
        restCurl += distal.addScaledVector(proximal, -distal.dot(proximal)).dot(palm);
      }
      if (Math.abs(restCurl) < 1e-6 ? side === 'right' : restCurl < 0) palm.negate();
      calibration.push({ side, forward: forward.toArray(), radial: radial.toArray(), palm: palm.toArray() });
      for (const digit of DIGITS) {
        const chain = chains[digit], profile = PROFILE[digit];
        // Capture every rest frame before changing any ancestor in this chain.
        const restFrames = chain.slice(0, 3).map((bone, index) => ({
          direction: point(chain[index + 1]).sub(point(bone)).normalize(),
          quaternion: inverseHandQ.clone().multiply(bone.getWorldQuaternion(Q())),
        }));
        for (let index = 0; index < chain.length; index++) {
          const bone = chain[index], rest = actor.rest.get(bone.uuid);
          let neutral = rest.q.clone();
          if (index < 3) {
            const spread = radians(profile.spread), curl = radians(profile.curl[index]);
            const wanted = forward.clone().multiplyScalar(Math.cos(curl) * Math.cos(spread))
              .addScaledVector(radial, Math.cos(curl) * Math.sin(spread)).addScaledVector(palm, Math.sin(curl)).normalize();
            const corrected = Q().setFromUnitVectors(restFrames[index].direction, wanted).multiply(restFrames[index].quaternion);
            const world = handQ.clone().multiply(corrected);
            neutral = bone.parent.getWorldQuaternion(Q()).invert().multiply(world).normalize();
          }
          bone.quaternion.copy(neutral); bone.updateMatrixWorld(true);
          targets.push({ bone, q: neutral, p: rest.p.clone(), s: rest.s.clone() });
        }
      }
    }
  } finally {
    for (const { bone, p, q, s } of saved) { bone.position.copy(p); bone.quaternion.copy(q); bone.scale.copy(s); }
    actor.refresh();
  }
  let enabled = true, strength = 1, last = { applied: false, weight: 0, clip: '', fingerBones: targets.length };
  return {
    apply({ frame, clip, preview, weight = 1 } = {}) {
      const selected = typeof preview === 'string' ? preview : clip ?? frame?.locomotion?.state ?? 'idle';
      const name = ({ idle: 'Stand', walk: 'Walk', run: 'Run' })[selected] ?? selected;
      const state = frame?.locomotion?.state;
      const airborne = frame?.locomotion?.grounded === false || ['jump', 'fall', 'land', 'landing', 'anticipation', 'fly'].includes(state) || frame?.pose?.mode === 'flying';
      const amount = enabled && !airborne && ['Stand', 'Walk', 'Run'].includes(name) ? strength * clampWeight(weight) : 0;
      if (amount > 0) {
        for (const { bone, p, q, s } of targets) {
          bone.position.lerp(p, amount); bone.quaternion.slerp(q, amount).normalize(); bone.scale.lerp(s, amount);
        }
        actor.refresh();
      }
      last = { applied: amount > 0, weight: amount, clip: name, fingerBones: targets.length };
      return { ...last };
    },
    setEnabled(value) { enabled = Boolean(value); },
    setWeight(value) { strength = clampWeight(value); },
    getStatus() { return { ...last, enabled, strength, calibration: calibration.map(item => ({ ...item })) }; },
  };
}
