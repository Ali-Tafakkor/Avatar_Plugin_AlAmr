import { BufferAttribute, Matrix3, Matrix4, Mesh, Quaternion, Triangle, Vector3 } from 'three';
import { FaceRig } from '../../../آواتار/src/web-v2/expressions.mjs';
import { boneName } from '../../../آواتار/src/web-v2/actor.mjs';
import { prepareEyeApertures } from './eye-rig.mjs';

export const FACE_GATE_SHAPES = Object.freeze(['mouthSmileLeft', 'mouthSmileRight', 'eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen']);
const V = () => new Vector3(), Q = () => new Quaternion(), M = () => new Matrix4();
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
function metricFrame(head) { return M().compose(head.getWorldPosition(V()), head.getWorldQuaternion(Q()), V().setScalar(1)); }

/** Exact per-vertex skin Jacobian: raw geometry delta -> physical head metres.
 * The V1 normalizer has ~94x scale; a quaternion-only raw-delta conversion is
 * incorrect. World/head rigid frames exclude translation from delta vectors.
 */
function meshData(mesh, head) {
  mesh.updateWorldMatrix(true, false); mesh.updateMatrixWorld(true);
  const frameInverse = metricFrame(head).invert(), positions = [], linear = [], headWeights = [];
  const base = frameInverse.clone().multiply(mesh.matrixWorld);
  const skin = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
  const skinBase = mesh.isSkinnedMesh ? base.clone().multiply(mesh.bindMatrixInverse) : base;
  const boneMatrices = mesh.isSkinnedMesh ? mesh.skeleton.bones.map((bone, index) => M().multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[index])) : [];
  const source = mesh.geometry.attributes.position;
  for (let index = 0; index < source.count; index++) {
    let transform = base, headWeight = mesh.isSkinnedMesh ? 0 : 1;
    if (mesh.isSkinnedMesh) {
      const values = new Array(16).fill(0);
      for (let component = 0; component < 4; component++) {
        const weight = weights.getComponent(index, component), joint = skin.getComponent(index, component);
        if (boneName(mesh.skeleton.bones[joint].name) === 'head') headWeight += weight;
        if (!weight) continue;
        const elements = boneMatrices[joint].elements;
        for (let k = 0; k < 16; k++) values[k] += weight * elements[k];
      }
      transform = skinBase.clone().multiply(M().fromArray(values)).multiply(mesh.bindMatrix);
    }
    positions.push(V().fromBufferAttribute(source, index).applyMatrix4(transform));
    linear.push(new Matrix3().setFromMatrix4(transform)); headWeights.push(headWeight);
  }
  return { positions, linear, headWeights };
}

function attributeValues(geometry, index) {
  return Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name,
    Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(index, component))]));
}
function interpolate(a, b, fraction) {
  const values = {};
  for (const name of Object.keys(a.values)) values[name] = a.values[name].map((value, index) => value + (b.values[name][index] - value) * fraction);
  // Seam vertices in the face are head rigid; merge influences if a source
  // triangle happens to cross the weighted neck transition.
  if (values.skinIndex && values.skinWeight) {
    const merged = new Map();
    for (const [record, scale] of [[a, 1 - fraction], [b, fraction]]) for (let i = 0; i < 4; i++) {
      const joint = record.values.skinIndex[i]; merged.set(joint, (merged.get(joint) || 0) + record.values.skinWeight[i] * scale);
    }
    const sorted = [...merged].sort((x, y) => y[1] - x[1]).slice(0, 4), sum = sorted.reduce((total, item) => total + item[1], 0);
    values.skinIndex = Array.from({ length: 4 }, (_, i) => sorted[i]?.[0] ?? 0);
    values.skinWeight = Array.from({ length: 4 }, (_, i) => (sorted[i]?.[1] ?? 0) / sum);
  }
  return { values, point: a.point.clone().lerp(b.point, fraction), index: null };
}

/** Cut a coincident neutral lip seam. Existing vertex order is preserved;
 * intersections are appended with interpolated original UVs and normals.
 */
function splitMouth(mesh, points, { mouthY, mouthWidth }) {
  const geometry = mesh.geometry, arrays = Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, Array.from(attribute.array)]));
  const indices = [], lower = new Set(), upper = new Set();
  const seamY = point => mouthY + 0.0015 * (point.x / mouthWidth) ** 2;
  const signed = point => point.y - seamY(point);
  const emit = (record, side) => {
    if (record.index !== null && Math.abs(signed(record.point)) > 1e-8) return record.index;
    const index = arrays.position.length / 3;
    for (const [name, values] of Object.entries(record.values)) arrays[name].push(...values);
    (side < 0 ? lower : upper).add(index); return index;
  };
  const clip = (polygon, side) => {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = signed(a.point) * side, db = signed(b.point) * side;
      if (da >= 0) result.push(a);
      if ((da < 0) !== (db < 0)) result.push(interpolate(a, b, da / (da - db)));
    }
    return result;
  };
  const original = geometry.index?.array ?? Array.from({ length: geometry.attributes.position.count }, (_, index) => index);
  let splitTriangles = 0;
  for (let index = 0; index < original.length; index += 3) {
    const triangle = [original[index], original[index + 1], original[index + 2]];
    const center = points[triangle[0]].clone().add(points[triangle[1]]).add(points[triangle[2]]).multiplyScalar(1 / 3);
    const distances = triangle.map(i => signed(points[i]));
    if (Math.abs(center.x) > mouthWidth || Math.abs(center.y - mouthY) > 0.012 || center.z < 0.103 || Math.min(...distances) >= 0 || Math.max(...distances) <= 0) {
      indices.push(...triangle); continue;
    }
    splitTriangles++;
    const polygon = triangle.map(i => ({ index: i, point: points[i], values: attributeValues(geometry, i) }));
    for (const side of [-1, 1]) {
      const part = clip(polygon, side), output = part.map(record => emit(record, side));
      for (let i = 1; i + 1 < output.length; i++) indices.push(output[0], output[i], output[i + 1]);
    }
  }
  for (const [name, array] of Object.entries(arrays)) {
    const originalAttribute = geometry.attributes[name];
    geometry.setAttribute(name, new BufferAttribute(new originalAttribute.array.constructor(array), originalAttribute.itemSize, originalAttribute.normalized));
  }
  geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { lower, upper, splitTriangles, originalVertices: points.length, appendedVertices: arrays.position.length / 3 - points.length };
}

/** First local quality gate: original V1 skin, UVs, clothes and identity, with
 * actual donor morph displacement fields registered onto only the V1 face.
 * Mouth and ocular topology are opened locally; no replacement head is used.
 */
export function createFaceTransfer(body, donor, options = {}) {
  const head = body.bones?.get('head');
  if (!head) throw new Error('hybrid_face_missing_v1_head');
  body.root.updateWorldMatrix(true, true); body.root.updateMatrixWorld(true); donor.refresh();
  const meshes = [];
  body.model.traverse(node => { if (node.isSkinnedMesh) meshes.push(node); });
  if (meshes.length !== 1) throw new Error('hybrid_face_expected_single_v1_mesh');
  const mesh = meshes[0], originalGeometry = mesh.geometry, initialGeometry = originalGeometry.clone(); mesh.geometry = initialGeometry;
  const originalDictionary = mesh.morphTargetDictionary, originalInfluences = mesh.morphTargetInfluences;
  const sourceMesh = donor.meshes.find(node => node.name === 'AvatarHead');
  if (!sourceMesh) throw new Error('hybrid_face_missing_v2_head');
  const shapes = options.shapes ?? FACE_GATE_SHAPES;
  for (const name of shapes) if (sourceMesh.morphTargetDictionary[name] === undefined) throw new Error('hybrid_face_missing_donor_shape_' + name);
  const mouthY = options.mouthY ?? 0.0445, mouthWidth = options.mouthWidth ?? 0.030;
  const eyes = options.eyes ?? [{ side: 'Left', center: [0.032, 0.1185, 0.110], radiusX: 0.019, radiusY: 0.009, lidUv: [0.682900, 0.159961] },
    { side: 'Right', center: [-0.032, 0.1185, 0.110], radiusX: 0.019, radiusY: 0.009, lidUv: [0.925593, 0.832690] }];
  let target = meshData(mesh, head);
  const mouth = splitMouth(mesh, target.positions, { mouthY, mouthWidth });
  const eyeRig = prepareEyeApertures(mesh, { head, eyes });
  target = meshData(mesh, head);
  const source = meshData(sourceMesh, donor.bones.get('head'));
  // Eye/mouth landmarks govern vertical registration; lateral cheek width is
  // allowed to grow smoothly beyond the pupils rather than shifting identity.
  const sourceEyeY = 0.0537, sourceMouthY = -0.015, targetEyeY = (eyes[0].center[1] + eyes[1].center[1]) / 2;
  const scaleY = (targetEyeY - mouthY) / (sourceEyeY - sourceMouthY), offsetY = mouthY - sourceMouthY * scaleY;
  const warp = point => V().set(point.x * (1 + 0.08 * smooth(0.035, 0.09, Math.abs(point.x))), point.y * scaleY + offsetY, point.z - 0.0115);
  const deltaWarp = (delta, point) => V().set(delta.x * (1 + 0.08 * smooth(0.035, 0.09, Math.abs(point.x))), delta.y * scaleY, delta.z);
  const sourcePoints = source.positions.map(warp), sourceIndices = sourceMesh.geometry.index.array, triangles = [];
  for (let i = 0; i < sourceIndices.length; i += 3) {
    const ids = [sourceIndices[i], sourceIndices[i + 1], sourceIndices[i + 2]], points = ids.map(index => sourcePoints[index]);
    const center = points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1 / 3);
    if (center.z > 0.025 && center.y > -0.030 && center.y < 0.180) {
      const oralDistances = ids.map(index => source.positions[index].y - (sourceMouthY + 0.0015 * (source.positions[index].x / mouthWidth) ** 2));
      triangles.push({ ids, shape: new Triangle(...points),
        lowerLip: Math.max(...oralDistances) < 0.00015, upperLip: Math.min(...oralDistances) > -0.00015 });
    }
  }
  const mapping = [], closest = V(), bary = V();
  let maxDistance = 0;
  for (let index = 0; index < target.positions.length; index++) {
    const point = target.positions[index];
    const mask = target.headWeights[index] * smooth(-0.045, -0.015, point.y) * (1 - smooth(0.155, 0.180, point.y))
      * smooth(0.025, 0.075, point.z) * (1 - smooth(0.075, 0.096, Math.abs(point.x)));
    if (mask < 0.001) continue;
    const lipRegion = Math.abs(point.x) < 0.036 && Math.abs(point.y - mouthY) < 0.024 && point.z > 0.085;
    const lowerLip = mouth.lower.has(index) || (!mouth.upper.has(index) && point.y < mouthY + 0.0015 * (point.x / mouthWidth) ** 2);
    let best = null, distance = Infinity;
    for (const triangle of triangles) {
      // A purely spatial nearest surface can map the V1 lower lip to the
      // protruding V2 upper lip, stretching an opaque triangular membrane
      // across the aperture. Keep upper/lower anatomical ownership explicit.
      if (lipRegion && !(lowerLip ? triangle.lowerLip : triangle.upperLip)) continue;
      triangle.shape.closestPointToPoint(point, closest); const d = closest.distanceToSquared(point);
      if (d < distance) { distance = d; triangle.shape.getBarycoord(closest, bary); best = { ids: triangle.ids, weights: bary.toArray() }; }
    }
    if (!best || distance > 0.025 ** 2) continue;
    maxDistance = Math.max(maxDistance, Math.sqrt(distance));
    mapping.push({ index, point, inverse: target.linear[index].clone().invert(), ...best, mask });
  }
  const geometry = mesh.geometry, positions = geometry.attributes.position, basePositions = positions.array.slice();
  const baseNormalsGeometry = geometry.clone(); baseNormalsGeometry.computeVertexNormals();
  const baseNormals = baseNormalsGeometry.attributes.normal.array.slice(), temporary = geometry.clone();
  const morphs = [], normals = [], shapeStats = [];
  for (const name of shapes) {
    const donorAttribute = sourceMesh.geometry.morphAttributes.position[sourceMesh.morphTargetDictionary[name]];
    const attribute = new Float32Array(positions.count * 3); let affected = 0, maximumMeters = 0;
    const donorDeltas = source.positions.map((point, index) => deltaWarp(V().fromBufferAttribute(donorAttribute, index).applyMatrix3(source.linear[index]), point));
    for (const item of mapping) {
      const delta = V(); item.ids.forEach((index, corner) => delta.addScaledVector(donorDeltas[index], item.weights[corner])); delta.multiplyScalar(item.mask);
      if (name.startsWith('mouthSmile')) delta.multiplyScalar(options.smileGain ?? 1.45);
      if (name === 'jawOpen' && mouth.lower.has(item.index)) {
        // The duplicated lower seam samples the donor's lower-lip side, rather
        // than sharing the upper lip's closed-surface correspondence.
        let nearest = -1, distance = Infinity;
        for (let i = 0; i < source.positions.length; i++) {
          const p = source.positions[i];
          if (p.y > sourceMouthY - 0.003 || p.y < sourceMouthY - 0.016 || p.z < 0.110) continue;
          const d = Math.abs(sourcePoints[i].x - item.point.x) + Math.abs(p.y - (sourceMouthY - 0.007));
          if (d < distance) { distance = d; nearest = i; }
        }
        if (nearest >= 0) delta.copy(donorDeltas[nearest]);
      }
      if (delta.lengthSq() > 1e-16) affected++;
      maximumMeters = Math.max(maximumMeters, delta.length()); delta.applyMatrix3(item.inverse).toArray(attribute, item.index * 3);
    }
    for (const constraint of eyeRig.blinkConstraints?.[name] ?? []) {
      const delta = V().fromArray(constraint.deltaHead), index = constraint.index;
      delta.applyMatrix3(target.linear[index].clone().invert()).toArray(attribute, index * 3);
    }
    morphs.push(new BufferAttribute(attribute, 3));
    const deformed = new Float32Array(basePositions.length);
    for (let i = 0; i < deformed.length; i++) deformed[i] = basePositions[i] + attribute[i];
    temporary.setAttribute('position', new BufferAttribute(deformed, 3)); temporary.computeVertexNormals();
    const normalDelta = new Float32Array(baseNormals.length);
    for (let i = 0; i < normalDelta.length; i++) normalDelta[i] = temporary.attributes.normal.array[i] - baseNormals[i];
    normals.push(new BufferAttribute(normalDelta, 3)); shapeStats.push({ name, affectedVertices: affected, maximumMeters });
  }
  temporary.dispose(); baseNormalsGeometry.dispose();
  geometry.morphAttributes.position = morphs; geometry.morphAttributes.normal = normals; geometry.morphTargetsRelative = true;
  mesh.updateMorphTargets(); mesh.morphTargetDictionary = Object.fromEntries(shapes.map((name, index) => [name, index]));

  // Actual donor teeth and internal mouth skin, transformed into V1's head
  // frame and hidden behind the coincident neutral lips. The lower teeth keep
  // the donor's real jawOpen displacement instead of following a fake emoji.
  const attachments = [];
  for (const donorMesh of [...donor.meshes.filter(node => /TeethUpper|TeethLower/.test(node.name)), sourceMesh]) {
    const data = meshData(donorMesh, donor.bones.get('head')), copy = donorMesh.geometry.clone();
    if (donorMesh === sourceMesh) {
      const internal = [], sourceIndex = donorMesh.geometry.index.array;
      for (let i = 0; i < sourceIndex.length; i += 3) {
        const ids = [sourceIndex[i], sourceIndex[i + 1], sourceIndex[i + 2]];
        if (ids.every(index => {
          const point = data.positions[index];
          return Math.abs(point.x) < 0.032 && point.y > -0.046 && point.y < -0.006 && point.z > 0.045 && point.z < 0.112;
        })) internal.push(...ids);
      }
      copy.setIndex(internal);
    }
    const intoLocal = head.matrixWorld.clone().invert().multiply(metricFrame(head));
    const linear = new Matrix3().setFromMatrix4(intoLocal), warped = data.positions.map(warp);
    const retreat = Math.max(0, Math.max(...warped.map(point => point.z)) - 0.119);
    copy.setAttribute('position', new BufferAttribute(new Float32Array(warped.flatMap(point => point.clone().add(V().set(0, 0, -retreat)).applyMatrix4(intoLocal).toArray())), 3));
    copy.deleteAttribute('skinIndex'); copy.deleteAttribute('skinWeight');
    copy.morphAttributes = { position: [] }; const names = [];
    for (const name of shapes) {
      const sourceIndex = donorMesh.morphTargetDictionary?.[name]; if (sourceIndex === undefined) continue;
      const raw = donorMesh.geometry.morphAttributes.position[sourceIndex], output = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++) deltaWarp(V().fromBufferAttribute(raw, i).applyMatrix3(data.linear[i]), data.positions[i]).applyMatrix3(linear).toArray(output, i * 3);
      copy.morphAttributes.position.push(new BufferAttribute(output, 3)); names.push(name);
    }
    copy.morphTargetsRelative = true; copy.computeVertexNormals();
    const attachment = new Mesh(copy, donorMesh.material); attachment.name = 'V1-mouth-' + donorMesh.name; attachment.frustumCulled = false;
    attachment.updateMorphTargets(); attachment.morphTargetDictionary = Object.fromEntries(names.map((name, i) => [name, i]));
    head.add(attachment); attachments.push(attachment);
  }
  const face = new FaceRig(body.model);
  const stats = { stage: 'five-channel-visual-quality-gate', originalVertices: originalGeometry.attributes.position.count,
    vertices: positions.count, headVertices: target.headWeights.filter(weight => weight > 0.8).length,
    transferredVertices: mapping.length, maximumCorrespondenceDistanceMeters: maxDistance, shapes: shapeStats,
    mouth: { splitTriangles: mouth.splitTriangles, appendedVertices: mouth.appendedVertices, lowerSeamVertices: mouth.lower.size, upperSeamVertices: mouth.upper.size },
    eyes: eyeRig.stats, attachments: attachments.map(item => item.name), registration: { sourceEyeY, sourceMouthY, targetEyeY, mouthY, scaleY, offsetY } };
  let disposed = false;
  return { face, stats, eyeRig,
    eyes() { return V().fromArray([0, targetEyeY, 0.110]).applyMatrix4(metricFrame(head)); },
    eyeAnchor() { return this.eyes(); },
    dispose() {
      if (disposed) return; disposed = true;
      for (const attachment of attachments) { attachment.removeFromParent(); attachment.geometry.dispose(); }
      eyeRig.dispose(); initialGeometry.dispose();
      mesh.geometry = originalGeometry; mesh.morphTargetDictionary = originalDictionary; mesh.morphTargetInfluences = originalInfluences;
    },
  };
}
