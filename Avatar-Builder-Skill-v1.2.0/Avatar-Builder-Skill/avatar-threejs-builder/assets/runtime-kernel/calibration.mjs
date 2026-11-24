/** Dependency-free calibration building blocks. No model loading, rig writes,
 * terrain query or renderer. Metres/radians; quaternions [x,y,z,w]. */
const finite = (v, name) => { if (!Number.isFinite(v)) throw new TypeError(name + ' must be finite'); return v; };
const bound = (v, min, max) => Math.max(min, Math.min(max, v));
const range = (v, min, max, name) => {
  finite(v, name); if (v < min || v > max) throw new RangeError(name + ' outside range'); return v;
};
const vec3 = (value, name) => {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(name + ' requires 3 coordinates');
  return value.map((v, i) => finite(v, name + '[' + i + ']'));
};

/** Two support patches in a per-foot sagittal (along, height) frame.
 * Positive pitch raises positive along. Ground samples are held fixed during
 * this approximation; a real terrain bridge must remeasure after applying it.
 * Each patch: {along,height,supportHeight,clearanceMeters?}. Pivot same frame.
 * Explicit bounds prevent a bad rig from being silently stretched into place.
 */
export function fitSoleContacts({ heel, forefoot, pivot, maxPitchRadians,
  maxShiftMeters, grounded, stance, override = false, weight = 1 }) {
  range(weight, 0, 1, 'weight');
  if (grounded !== true || stance !== true || override || weight === 0) {
    return { active: false, reason: 'released', pitchRadians: 0, shiftMeters: 0,
      limited: false, residuals: null };
  }
  range(maxPitchRadians, 0, Math.PI / 2, 'maxPitchRadians');
  if (finite(maxShiftMeters, 'maxShiftMeters') < 0) throw new RangeError('maxShiftMeters');
  const patches = [heel, forefoot].map((p, i) => {
    if (!p) throw new TypeError('Missing support patch ' + i);
    const clearance = p.clearanceMeters ?? 0;
    if (finite(clearance, 'clearanceMeters') < 0) throw new RangeError('clearanceMeters');
    const supportHeight = finite(p.supportHeight, 'supportHeight');
    return { along: finite(p.along, 'along'), height: finite(p.height, 'height'),
      supportHeight, target: supportHeight + clearance };
  });
  const px = finite(pivot?.along, 'pivot.along'), py = finite(pivot?.height, 'pivot.height');
  const [a, b] = patches, dx = b.along - a.along, dy = b.height - a.height;
  if (dx <= 0) throw new RangeError('Forefoot must be ahead of heel in calibrated along frame');
  const length = Math.hypot(dx, dy), groundDelta = b.target - a.target;
  const unreachable = Math.abs(groundDelta) > length;
  const desiredPitch = Math.asin(bound(groundDelta / length, -1, 1)) - Math.atan2(dy, dx);
  const boundedPitch = bound(desiredPitch, -maxPitchRadians, maxPitchRadians);
  const pitch = boundedPitch * weight;
  const rotatedHeight = p => py + (p.height - py) * Math.cos(pitch) + (p.along - px) * Math.sin(pitch);
  const desiredShift = patches.reduce((sum, p) => sum + p.target - rotatedHeight(p), 0) / patches.length;
  const boundedShift = bound(desiredShift, -maxShiftMeters, maxShiftMeters);
  const shift = boundedShift * weight;
  const residuals = patches.map(p => rotatedHeight(p) + shift - p.target);
  return { active: true, reason: 'two-patch-sagittal-fit', pitchRadians: pitch,
    shiftMeters: shift, limited: unreachable || Math.abs(desiredPitch - boundedPitch) > 1e-10
      || Math.abs(desiredShift - boundedShift) > 1e-10,
    unreachableSupportDelta: unreachable,
    residuals: { heel: residuals[0], forefoot: residuals[1],
      maxAbs: Math.max(...residuals.map(Math.abs)),
      maxClearanceDeficit: Math.max(0, ...residuals.map(v => -v)),
      maxPenetration: Math.max(0, ...patches.map(p => p.supportHeight - rotatedHeight(p) - shift)) } };
}

/** Scale-relative reachable distance for a two-bone chain; not an IK solver. */
export function clampLimbReach(distance, upperLength, lowerLength, epsilonRatio = 1e-6) {
  if (finite(distance, 'distance') < 0) throw new RangeError('distance');
  if (finite(upperLength, 'upperLength') <= 0 || finite(lowerLength, 'lowerLength') <= 0) throw new RangeError('Bone length');
  range(epsilonRatio, Number.EPSILON, 0.1, 'epsilonRatio');
  const epsilon = (upperLength + lowerLength) * epsilonRatio;
  const min = Math.abs(upperLength - lowerLength) + epsilon;
  const max = upperLength + lowerLength - epsilon;
  if (min >= max) throw new RangeError('Degenerate chain at this epsilon');
  const value = bound(distance, min, max);
  return { distance: value, min, max, limited: Math.abs(value - distance) > epsilon * 1e-3 };
}

function quaternion(value) {
  if (!Array.isArray(value) || value.length !== 4) throw new TypeError('Quaternion requires 4 coordinates');
  const q = value.map(v => finite(v, 'quaternion'));
  const length = Math.hypot(...q);
  if (length < 1e-12) throw new RangeError('Zero quaternion');
  return q.map(v => v / length);
}
function multiply(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz];
}

/** q = freshBase * slerp(identity, calibratedLocalDelta, weight).
 * Caller owns frame conversion/limits and must supply the uncorrected base
 * every frame. The same input remains stable; feeding the output back drifts.
 */
export function composeLocalOffset(freshBase, localDelta, weight) {
  range(weight, 0, 1, 'weight');
  const base = quaternion(freshBase); let q = quaternion(localDelta);
  if (q[3] < 0) q = q.map(v => -v);
  const angle = Math.acos(bound(q[3], -1, 1));
  const sine = Math.sin(angle);
  const weighted = sine < 1e-9
    ? quaternion([q[0] * weight, q[1] * weight, q[2] * weight, 1 + (q[3] - 1) * weight])
    : [q[0] * Math.sin(angle * weight) / sine, q[1] * Math.sin(angle * weight) / sine,
      q[2] * Math.sin(angle * weight) / sine, Math.cos(angle * weight)];
  return quaternion(multiply(base, weighted));
}

/** Apply a point warp to relative morph endpoints consistently. Arrays contain
 * one point/delta per vertex. This does not transform normals, binds or other
 * meshes; the authoring adapter must do that work separately. Inputs unchanged.
 */
export function warpRelativeMorphs(base, targets, warp) {
  if (!Array.isArray(base) || !Array.isArray(targets) || typeof warp !== 'function') throw new TypeError('Invalid morph input');
  const original = base.map((p, i) => vec3(p, 'base' + i));
  const shaped = original.map(p => vec3(warp([...p]), 'warpedBase'));
  const deltas = targets.map(target => {
    if (!Array.isArray(target) || target.length !== original.length) throw new RangeError('Morph vertex count mismatch');
    return target.map((delta, index) => {
      const d = vec3(delta, 'delta'), p = original[index];
      const endpoint = vec3(warp(p.map((v, i) => v + d[i])), 'warpedEndpoint');
      return endpoint.map((v, i) => v - shaped[index][i]);
    });
  });
  return { base: shaped, targets: deltas };
}
