/** Calibration and measurement in a shared Cartesian frame, in metres. */
function vector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(label + ' must be an array of three finite numbers');
  }
  return value;
}

function nonnegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(label + ' must be finite and nonnegative');
  return value;
}

function unit(value) {
  const length = Math.hypot(...vector(value, 'normal'));
  if (length === 0 || !Number.isFinite(length)) throw new RangeError('Invalid plane normal');
  return value.map(component => component / length);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Fit a convex region to skinned rest samples. Supply a bounded set of
 * outward normals (for example, both directions along every local axis).
 * The caller chooses anatomical regions and transports each fit with its bone.
 */
export function fitConvexContactRegion(points, normals, { paddingMeters = 0, quantile = 1 } = {}) {
  if (!points.length || normals.length < 4) throw new RangeError('Insufficient samples or planes');
  nonnegative(paddingMeters, 'paddingMeters');
  if (!Number.isFinite(quantile) || quantile <= 0 || quantile > 1) throw new RangeError('quantile must be in (0, 1]');
  for (const point of points) vector(point, 'point');

  return normals.map(direction => {
    const normal = unit(direction);
    const projections = points.map(point => dot(point, normal)).sort((a, b) => a - b);
    const limit = projections[Math.ceil(quantile * projections.length) - 1] + paddingMeters;
    return { normal, limit };
  });
}

/** Return the deepest penetrating sample and its nearest exit plane. Planes
 * come from the fit and have unit normals. Boundary points have zero depth.
 */
export function deepestConvexContact(points, planes) {
  if (planes.length < 4) throw new RangeError('Insufficient planes');
  let hit = null;
  for (const point of points) {
    vector(point, 'point');
    let depthMeters = Infinity;
    let nearest;
    for (const plane of planes) {
      const depth = plane.limit - dot(point, plane.normal);
      if (depth < depthMeters) {
        depthMeters = depth;
        nearest = plane;
      }
      if (depthMeters <= 0) break;
    }
    if (depthMeters > (hit?.depthMeters ?? 0)) {
      hit = { point: [...point], normal: [...nearest.normal], depthMeters };
    }
  }
  return hit;
}

/** Propose one small world-space rotation around a pivot. The lever, surface
 * normal and penetration must share the same frame. Apply onto the fresh pose,
 * enforce an angular budget for all iterations, and remeasure actual skin.
 */
export function boundedContactRotation(hit, pivot, { maxRadians, clearanceMeters = 0, minLeverageMeters = 1e-6 }) {
  nonnegative(maxRadians, 'maxRadians');
  nonnegative(clearanceMeters, 'clearanceMeters');
  nonnegative(minLeverageMeters, 'minLeverageMeters');
  if (!hit || maxRadians === 0) return null;
  const depthMeters = nonnegative(hit.depthMeters, 'depthMeters');
  const [nx, ny, nz] = unit(hit.normal);
  vector(pivot, 'pivot');
  const [rx, ry, rz] = vector(hit.point, 'point').map((component, index) => component - pivot[index]);
  const cross = [ry * nz - rz * ny, rz * nx - rx * nz, rx * ny - ry * nx];
  const leverage = Math.hypot(...cross);
  if (depthMeters === 0 || leverage <= minLeverageMeters || !Number.isFinite(leverage)) return null;
  const requiredRadians = (depthMeters + clearanceMeters) / leverage;
  return {
    axis: cross.map(component => component / leverage),
    radians: Math.min(maxRadians, requiredRadians),
    limited: requiredRadians > maxRadians,
  };
}
