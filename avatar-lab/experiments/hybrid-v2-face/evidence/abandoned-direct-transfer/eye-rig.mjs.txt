import { BufferAttribute, SkinnedMesh, Vector3, Quaternion } from 'three';

const V = () => new Vector3();
const raw = (attribute, index, component) => attribute.isInterleavedBufferAttribute
  ? attribute.data.array[index * attribute.data.stride + attribute.offset + component]
  : attribute.array[index * attribute.itemSize + component];
const maxInteger = array => array instanceof Uint8Array ? 255 : array instanceof Uint16Array ? 65535 : array instanceof Uint32Array ? 4294967295 : 1;

/** Separate the existing painted eye surfaces without changing their neutral
 * shape, texture, skin or original vertex IDs. Only the cloned body geometry is
 * replaced; incoming geometry remains caller-owned. Call before creating morphs.
 * Canonical coordinates retain physical metres and remove head rotation only. */
export function prepareEyeApertures(bodyMesh, { head, eyes, polygonSides = 24 } = {}) {
  if (!bodyMesh?.isSkinnedMesh || !head || !Array.isArray(eyes)) throw new Error('eye_aperture_invalid_input');
  const source = bodyMesh.geometry;
  if (Object.values(source.morphAttributes).some(values => values.length)) throw new Error('eye_aperture_requires_neutral_geometry');
  if (source.groups.length > 1) throw new Error('eye_aperture_requires_single_material');
  bodyMesh.updateWorldMatrix(true, false); head.updateWorldMatrix(true, false); bodyMesh.skeleton.update();
  const headPosition = head.getWorldPosition(V()), headInverse = head.getWorldQuaternion(new Quaternion()).invert();
  const attributes = Object.fromEntries(Object.entries(source.attributes).map(([name, attribute]) => [name, {
    attribute, values: Array.from({ length: attribute.count * attribute.itemSize }, (_, i) => raw(attribute, Math.floor(i / attribute.itemSize), i % attribute.itemSize)),
  }]));
  const originalCount = source.attributes.position.count;
  const points = Array.from({ length: originalCount }, (_, i) => bodyMesh.getVertexPosition(i, V()).applyMatrix4(bodyMesh.matrixWorld).sub(headPosition).applyQuaternion(headInverse).toArray());
  let bodyIndices = source.index ? Array.from(source.index.array) : Array.from({ length: originalCount }, (_, i) => i);
  const generated = new Map(), patches = [], constraints = {}, seamPoints = new Map();
  const sourceIndices = bodyIndices.slice();
  let interpolationError = 0;

  const vertex = (indices, barycentric) => ({ indices, b: barycentric,
    p: [0, 1, 2].map(axis => indices.reduce((sum, index, i) => sum + points[index][axis] * barycentric[i], 0)) });
  const interpolate = (a, b, t) => vertex(a.indices, a.b.map((value, i) => value + (b.b[i] - value) * t));
  function clip(polygon, edgeA, edgeB, inside) {
    if (!polygon.length) return [];
    const distance = value => (edgeB[0] - edgeA[0]) * (value.p[1] - edgeA[1]) - (edgeB[1] - edgeA[1]) * (value.p[0] - edgeA[0]);
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
      const keepA = inside ? da >= -1e-14 : da <= 1e-14, keepB = inside ? db >= -1e-14 : db <= 1e-14;
      if (keepA) result.push(a);
      if (keepA !== keepB && Math.abs(da - db) > 1e-20) result.push(interpolate(a, b, da / (da - db)));
    }
    return result.filter((value, i) => !i || Math.hypot(...value.p.map((v, axis) => v - result[i - 1].p[axis])) > 1e-12);
  }
  function append(value) {
    const exact = value.b.findIndex(weight => weight > 1 - 1e-10);
    if (exact >= 0) return value.indices[exact];
    const key = value.indices.map((index, i) => [index, value.b[i]]).filter(([, weight]) => weight > 1e-10)
      .sort((a, b) => a[0] - b[0]).map(([index, weight]) => index + ':' + Math.round(weight * 1e10)).join('|');
    if (generated.has(key)) return generated.get(key);
    const index = points.length;
    const influences = new Map();
    if (attributes.skinIndex && attributes.skinWeight) {
      for (let i = 0; i < value.indices.length; i++) for (let c = 0; c < attributes.skinIndex.attribute.itemSize; c++) {
        const sourceIndex = value.indices[i], bone = attributes.skinIndex.values[sourceIndex * 4 + c];
        let weight = attributes.skinWeight.values[sourceIndex * 4 + c];
        if (attributes.skinWeight.attribute.normalized) weight /= maxInteger(attributes.skinWeight.attribute.array);
        influences.set(bone, (influences.get(bone) ?? 0) + weight * value.b[i]);
      }
    }
    const skin = [...influences].filter(([, weight]) => weight > 1e-12).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = skin.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    for (const [name, { attribute, values }] of Object.entries(attributes)) {
      let tuple;
      if (name === 'skinIndex') tuple = Array.from({ length: attribute.itemSize }, (_, c) => skin[c]?.[0] ?? 0);
      else if (name === 'skinWeight') tuple = Array.from({ length: attribute.itemSize }, (_, c) => (skin[c]?.[1] ?? 0) / total * (attribute.normalized ? maxInteger(attribute.array) : 1));
      else tuple = Array.from({ length: attribute.itemSize }, (_, c) => value.indices.reduce((sum, sourceIndex, i) => sum + values[sourceIndex * attribute.itemSize + c] * value.b[i], 0));
      if (name === 'normal' || name === 'tangent') {
        const length = Math.hypot(tuple[0], tuple[1], tuple[2]);
        if (length > 1e-12) for (let c = 0; c < 3; c++) tuple[c] /= length;
      }
      values.push(...tuple);
    }
    points.push(value.p); generated.set(key, index); return index;
  }
  function emit(polygon, output, seam) {
    if (polygon.length < 3) return;
    const emitted = polygon.map(value => {
      const index = append(value);
      if (seam && seam(value.p)) seamPoints.get(seam.eyeName).set(index, value.p);
      return index;
    });
    for (let i = 1; i + 1 < emitted.length; i++) {
      const a = points[emitted[0]], b = points[emitted[i]], c = points[emitted[i + 1]];
      const area = V().fromArray(b).sub(V().fromArray(a)).cross(V().fromArray(c).sub(V().fromArray(a))).lengthSq();
      if (area > 1e-24) output.push(emitted[0], emitted[i], emitted[i + 1]);
    }
  }
  // Read the visible surface at an exact head-space XY point. The original
  // model has overlapping face surfaces: a neighboring vertex maximum can
  // therefore pull an otherwise hidden orbital layer forward by centimetres.
  function surfaceAt(x, y, indices) {
    let best = null;
    for (let i = 0; i < indices.length; i += 3) {
      const ids = indices.slice(i, i + 3), [a, b, c] = ids.map(index => points[index]);
      const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-20) continue;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
      if (Math.min(u, v, 1 - u - v) < -1e-7) continue;
      const sample = vertex(ids, [u, v, 1 - u - v]);
      if (!best || sample.p[2] > best.p[2]) best = sample;
    }
    return best;
  }
  function duplicate(index, uv) {
    const result = points.length;
    for (const [name, { attribute, values }] of Object.entries(attributes)) {
      const tuple = values.slice(index * attribute.itemSize, (index + 1) * attribute.itemSize);
      values.push(...(name === 'uv' && uv ? uv : tuple));
    }
    points.push(points[index].slice());
    return result;
  }

  for (const eye of eyes) {
    const name = 'eyeBlink' + eye.side;
    if (!(eye.radiusX > 0 && eye.radiusY > 0)) throw new Error('eye_aperture_invalid_radius');
    const [cx, cy, cz] = eye.center;
    const polygon = Array.from({ length: polygonSides }, (_, i) => {
      const angle = 2 * Math.PI * i / polygonSides;
      return [cx + Math.cos(angle) * eye.radiusX, cy + Math.sin(angle) * eye.radiusY];
    });
    const nextBody = [], ocular = [];
    seamPoints.set(name, new Map());
    const isSeam = p => Math.abs(((p[0] - cx) / eye.radiusX) ** 2 + ((p[1] - cy) / eye.radiusY) ** 2 - 1) < 0.035;
    isSeam.eyeName = name;
    for (let i = 0; i < bodyIndices.length; i += 3) {
      const indices = bodyIndices.slice(i, i + 3), xyz = indices.map(index => points[index]);
      const minX = Math.min(...xyz.map(p => p[0])), maxX = Math.max(...xyz.map(p => p[0]));
      const minY = Math.min(...xyz.map(p => p[1])), maxY = Math.max(...xyz.map(p => p[1]));
      const meanZ = xyz.reduce((sum, p) => sum + p[2], 0) / 3;
      if (maxX < cx - eye.radiusX || minX > cx + eye.radiusX || maxY < cy - eye.radiusY || minY > cy + eye.radiusY || meanZ < cz - 0.035 || meanZ > cz + 0.045) {
        nextBody.push(...indices); continue;
      }
      let remaining = [vertex(indices, [1, 0, 0]), vertex(indices, [0, 1, 0]), vertex(indices, [0, 0, 1])];
      const outside = [];
      for (let edge = 0; edge < polygon.length && remaining.length; edge++) {
        outside.push(clip(remaining, polygon[edge], polygon[(edge + 1) % polygon.length], false));
        remaining = clip(remaining, polygon[edge], polygon[(edge + 1) % polygon.length], true);
      }
      if (remaining.length < 3) { nextBody.push(...indices); continue; }
      for (const fragment of outside) emit(fragment, nextBody, isSeam);
      emit(remaining, ocular, null);
    }
    if (!ocular.length) throw new Error('eye_aperture_no_surface_' + eye.side);
    // Keep the aperture rim fixed. Pulling the surrounding face into the slit
    // stretches its topology and never guarantees an opaque covering surface.
    constraints[name] = [...seamPoints.get(name)].map(([index]) => ({ index, deltaHead: [0, 0, 0] }));
    const fixedBoundaryVertices = constraints[name].length, strips = [], lidSteps = 6;
    // V1 has many disconnected atlas islands. UVs from neighboring spatial
    // samples cannot be interpolated across a strip: their connecting UV line
    // can cross the purple garment. A single original skin texel keeps the
    // lid in one coherent island; its shape is shaded by the actual geometry.
    const skinPoint = eye.skinPoint ?? [cx, cy + eye.radiusY * 1.8];
    const skin = surfaceAt(skinPoint[0], skinPoint[1], sourceIndices);
    const skinIndex = skin ? append(skin) : null;
    const lidUv = eye.lidUv ?? (skinIndex === null ? null : attributes.uv?.values.slice(skinIndex * 2, skinIndex * 2 + 2));
    if (attributes.uv && !lidUv) throw new Error('eye_aperture_missing_skin_uv_' + eye.side);
    let maximumLidDepth = 0;
    for (const half of [1, -1]) {
      const rows = [];
      for (let step = 0; step <= polygonSides; step++) {
        const segment = Math.min(polygonSides / 2 - 1, Math.floor(step / 2)), fraction = step / 2 - segment;
        const angleA = half * 2 * Math.PI * segment / polygonSides, angleB = half * 2 * Math.PI * (segment + 1) / polygonSides;
        const x = cx + (Math.cos(angleA) * (1 - fraction) + Math.cos(angleB) * fraction) * eye.radiusX;
        const y = cy + (Math.sin(angleA) * (1 - fraction) + Math.sin(angleB) * fraction) * eye.radiusY;
        const rim = surfaceAt(x, y, ocular) ?? surfaceAt(cx + (x - cx) * (1 - 1e-6), cy + (y - cy) * (1 - 1e-6), ocular);
        if (!rim) throw new Error('eye_aperture_missing_rim_' + eye.side);
        const rimIndex = append(rim);
        const row = [];
        for (let depth = 0; depth <= lidSteps; depth++) {
          const fraction = depth / lidSteps, index = duplicate(rimIndex, lidUv);
          // A submillimetre overlap hides Float32 skinning error at the slit;
          // without overlap the two exact mathematical edges can leave a crack.
          const closedY = y + (cy - half * 0.00025 - y) * fraction;
          const cover = surfaceAt(x, closedY, ocular) ?? rim;
          const closedZ = fraction === 0 ? rim.p[2] : cover.p[2] + 0.001;
          const deltaHead = [0, closedY - rim.p[1], closedZ - rim.p[2]];
          maximumLidDepth = Math.max(maximumLidDepth, Math.abs(deltaHead[2]));
          constraints[name].push({ index, deltaHead }); row.push(index);
        }
        rows.push(row);
      }
      for (let row = 0; row + 1 < rows.length; row++) for (let depth = 0; depth < lidSteps; depth++) {
        const a = rows[row][depth], b = rows[row + 1][depth], c = rows[row + 1][depth + 1], d = rows[row][depth + 1];
        // Match the +Z-facing original face winding for both lid halves.
        if (half > 0) strips.push(a, b, c, a, c, d);
        else strips.push(a, c, b, a, d, c);
      }
    }
    nextBody.push(...strips); bodyIndices = nextBody;
    patches.push({ eye, name, indices: ocular, boundaryVertices: fixedBoundaryVertices,
      lidVertices: constraints[name].length - fixedBoundaryVertices, lidTriangles: strips.length / 3, maximumLidDepthMeters: maximumLidDepth,
      lidUv, skinPoint });
  }

  const geometry = source.clone();
  geometry.clearGroups(); geometry.morphAttributes = {};
  for (const [name, { attribute, values }] of Object.entries(attributes)) {
    const ArrayType = attribute.isInterleavedBufferAttribute ? attribute.data.array.constructor : attribute.array.constructor;
    geometry.setAttribute(name, new BufferAttribute(new ArrayType(values), attribute.itemSize, attribute.normalized));
  }
  geometry.setIndex(bodyIndices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  bodyMesh.geometry = geometry;
  const eyeMeshes = patches.map(patch => {
    const surface = geometry.clone(); surface.morphAttributes = {}; surface.setIndex(patch.indices); surface.clearGroups();
    const eye = new SkinnedMesh(surface, bodyMesh.material);
    eye.name = 'V1-original-eye-' + patch.eye.side;
    eye.position.copy(bodyMesh.position); eye.quaternion.copy(bodyMesh.quaternion); eye.scale.copy(bodyMesh.scale);
    eye.matrixAutoUpdate = bodyMesh.matrixAutoUpdate; eye.matrix.copy(bodyMesh.matrix);
    eye.bindMode = bodyMesh.bindMode; eye.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    eye.frustumCulled = false; eye.castShadow = bodyMesh.castShadow; eye.receiveShadow = bodyMesh.receiveShadow;
    bodyMesh.parent?.add(eye); return eye;
  });
  bodyMesh.updateWorldMatrix(true, true); bodyMesh.skeleton.update();
  for (let i = originalCount; i < points.length; i++) {
    const measured = bodyMesh.getVertexPosition(i, V()).applyMatrix4(bodyMesh.matrixWorld).sub(headPosition).applyQuaternion(headInverse);
    interpolationError = Math.max(interpolationError, measured.distanceTo(V().fromArray(points[i])));
  }
  let disposed = false;
  return {
    eyeMeshes, blinkConstraints: constraints,
    stats: { originalVertices: originalCount, vertices: points.length, addedVertices: points.length - originalCount,
      bodyTriangles: bodyIndices.length / 3, ocularTriangles: patches.map(patch => ({ side: patch.eye.side, triangles: patch.indices.length / 3,
        boundaryVertices: patch.boundaryVertices, lidVertices: patch.lidVertices, lidTriangles: patch.lidTriangles, maximumLidDepthMeters: patch.maximumLidDepthMeters,
        lidUv: patch.lidUv, skinPoint: patch.skinPoint })),
      originalVertexOrderPreserved: true, maximumNeutralInterpolationErrorMeters: interpolationError,
      neutralIdentity: 'original V1 surfaces partitioned; no replacement eye texture or eye shape' },
    dispose() {
      if (disposed) return; disposed = true;
      for (const eye of eyeMeshes) { eye.removeFromParent(); eye.geometry.dispose(); }
      geometry.dispose();
    },
  };
}
