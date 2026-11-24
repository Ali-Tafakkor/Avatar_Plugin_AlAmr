/** Frame-rate independent, renderer-free helpers. Units are metres and seconds. */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const dampAngle = (a, b, lambda, dt) => a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt));
export function moveToward2(vx, vz, tx, tz, maxDelta) {
  const dx = tx - vx, dz = tz - vz, d = Math.hypot(dx, dz);
  return d <= maxDelta || d === 0 ? [tx, tz] : [vx + dx / d * maxDelta, vz + dz / d * maxDelta];
}
export function cameraRelative(x, z, yaw) {
  const n = Math.hypot(x, z);
  if (!n) return [0, 0];
  x /= Math.max(1, n); z /= Math.max(1, n);
  // z > 0 means forward, i.e. away from a camera looking towards its orbit centre.
  return [Math.cos(yaw) * x - Math.sin(yaw) * z, -Math.sin(yaw) * x - Math.cos(yaw) * z];
}
export function seededRandom(seed = 1027) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
