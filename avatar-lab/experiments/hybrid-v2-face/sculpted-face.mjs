import { BufferAttribute, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float, materialColor, mix, smoothstep, texture, vec3 } from 'three/tsl';
import { FaceRig } from '../../../آواتار/src/web-v2/expressions.mjs';
import { mountReplacementHead } from './head-mount.mjs';

const V = () => new Vector3(), Q = () => new Quaternion(), M = () => new Matrix4();
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
const metricFrame = head => M().compose(head.getWorldPosition(V()), head.getWorldQuaternion(Q()), V().setScalar(1));

/** A gentle one-to-one sculpture in metres. The native lips, lid aperture and
 * oral cavity remain one coherent topology. The neck anchor is protected. */
export function sculptHeadPoint(point, options = {}, output = V()) {
  const amount = options.sculptAmount ?? 1;
  const face = smooth(-0.090, -0.045, point.y) * amount;
  const cheek = Math.exp(-(((point.y - 0.025) / 0.052) ** 2)) * smooth(0.025, 0.085, point.z);
  const jaw = Math.exp(-(((point.y + 0.036) / 0.035) ** 2));
  const quiff = smooth(0.105, 0.155, point.y) * smooth(0.005, 0.065, point.z)
    * (1 - smooth(0.045, 0.090, Math.abs(point.x))) * face;
  return output.set(
    point.x * (1 + face * (0.075 + 0.030 * cheek + 0.025 * jaw)),
    point.y - face * 0.008 * smooth(0.100, 0.200, point.y) + quiff * 0.008,
    point.z + face * 0.002 * cheek * smooth(0.016, 0.050, Math.abs(point.x)) + quiff * 0.004,
  );
}

function meshFrame(mesh, head) {
  const base = metricFrame(head).invert().multiply(mesh.matrixWorld);
  const geometry = mesh.geometry, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  const prefix = mesh.isSkinnedMesh ? base.clone().multiply(mesh.bindMatrixInverse) : base;
  const boneMatrices = mesh.isSkinnedMesh ? mesh.skeleton.bones.map((bone, index) => M().multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[index])) : [];
  return Array.from({ length: geometry.attributes.position.count }, (_, index) => {
    let matrix = base;
    if (mesh.isSkinnedMesh) {
      const values = new Array(16).fill(0);
      for (let c = 0; c < 4; c++) {
        const weight = weights.getComponent(index, c);
        if (!weight) continue;
        const elements = boneMatrices[indices.getComponent(index, c)].elements;
        for (let k = 0; k < 16; k++) values[k] += weight * elements[k];
      }
      matrix = prefix.clone().multiply(M().fromArray(values)).multiply(mesh.bindMatrix);
    }
    const linear = new Matrix3().setFromMatrix4(matrix);
    return { point: V().fromBufferAttribute(geometry.attributes.position, index).applyMatrix4(matrix), linear, inverse: linear.clone().invert() };
  });
}

function normalTransform(record, point, options) {
  const epsilon = 0.00001, center = sculptHeadPoint(point, options);
  const columns = [V().set(epsilon, 0, 0), V().set(0, epsilon, 0), V().set(0, 0, epsilon)]
    .map(axis => sculptHeadPoint(point.clone().add(axis), options).sub(center).divideScalar(epsilon));
  const jacobian = new Matrix3().set(columns[0].x, columns[1].x, columns[2].x,
    columns[0].y, columns[1].y, columns[2].y, columns[0].z, columns[1].z, columns[2].z);
  return record.inverse.clone().multiply(jacobian).multiply(record.linear).invert().transpose();
}

function styleMasks(point) {
  const front = smooth(0.055, 0.100, point.z);
  const scalp = Math.max(smooth(0.075, 0.105, point.y),
    (1 - smooth(0.015, 0.065, point.z)) * smooth(-0.055, -0.025, point.y),
    smooth(0.055, 0.085, Math.abs(point.x)) * smooth(0.020, 0.065, point.y));
  const brow = Math.exp(-(((point.y - 0.066) / 0.019) ** 2)) * Math.exp(-(((Math.abs(point.x) - 0.035) / 0.028) ** 2)) * front;
  const lip = (1 - smooth(0.025, 0.038, Math.abs(point.x))) * (1 - smooth(0.006, 0.012, Math.abs(point.y + 0.019)));
  const beard = (1 - smooth(0.002, 0.014, point.y)) * smooth(-0.080, -0.055, point.y) * front * (1 - lip);
  // The crown's native map contains very bright baked highlights. These are
  // still hair and must not fall back to skin tint at a texture triangle edge.
  // This conservative inner-scalp mask stops above the forehead and ears.
  const solidScalp = Math.max(smooth(0.120, 0.145, point.y),
    (1 - smooth(-0.025, 0.005, point.z)) * smooth(0.015, 0.050, point.y),
    smooth(0.070, 0.088, Math.abs(point.x)) * smooth(0.055, 0.085, point.y) * (1 - smooth(0.040, 0.070, point.z)));
  return [Math.min(1, Math.max(scalp, brow, beard)), solidScalp, 0];
}

function sculptMesh(mesh, head, options) {
  const geometry = mesh.geometry, records = meshFrame(mesh, head), positions = geometry.attributes.position;
  const baseNormal = geometry.attributes.normal, baseNormals = baseNormal?.array.slice();
  const relative = geometry.morphTargetsRelative, morphPositions = geometry.morphAttributes.position ?? [];
  const morphNormals = geometry.morphAttributes.normal ?? [];
  const sourcePositions = positions.array.slice(), sourceMorphs = morphPositions.map(a => a.array.slice());
  const sourceMorphNormals = morphNormals.map(a => a.array.slice());
  let maxDisplacement = 0, protectedNeckVertices = 0;
  const style = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const record = records[i], point = record.point, shaped = sculptHeadPoint(point, options);
    const local = V().fromArray(sourcePositions, i * 3).add(shaped.clone().sub(point).applyMatrix3(record.inverse));
    positions.setXYZ(i, local.x, local.y, local.z);
    maxDisplacement = Math.max(maxDisplacement, shaped.distanceTo(point));
    if (point.y <= -0.090) protectedNeckVertices++;
    style.set(styleMasks(point), i * 3);
    const nativeNormal = baseNormals && V().fromArray(baseNormals, i * 3);
    const normal = nativeNormal?.clone().applyMatrix3(normalTransform(record, point, options)).normalize();
    if (normal) baseNormal.setXYZ(i, normal.x, normal.y, normal.z);
    for (let target = 0; target < morphPositions.length; target++) {
      const original = V().fromArray(sourceMorphs[target], i * 3);
      const nativeDelta = relative ? original : original.sub(V().fromArray(sourcePositions, i * 3));
      const endpoint = point.clone().add(nativeDelta.applyMatrix3(record.linear));
      const delta = sculptHeadPoint(endpoint, options).sub(shaped).applyMatrix3(record.inverse);
      if (!relative) delta.add(local);
      morphPositions[target].setXYZ(i, delta.x, delta.y, delta.z);
      if (morphNormals[target] && nativeNormal) {
        const originalNormal = V().fromArray(sourceMorphNormals[target], i * 3);
        if (relative) originalNormal.add(nativeNormal);
        originalNormal.applyMatrix3(normalTransform(record, endpoint, options)).normalize();
        if (relative) originalNormal.sub(normal);
        morphNormals[target].setXYZ(i, originalNormal.x, originalNormal.y, originalNormal.z);
      }
    }
  }
  geometry.setAttribute('avatarFaceStyle', new BufferAttribute(style, 3));
  positions.needsUpdate = true; if (baseNormal) baseNormal.needsUpdate = true;
  for (const a of [...morphPositions, ...morphNormals]) a.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { mesh: mesh.name, vertices: positions.count, targets: morphPositions.length, maxDisplacementMeters: maxDisplacement, protectedNeckVertices };
}

/** Recolor the native maps in the real material pipeline; no new face texture,
 * eye overlay, or painted replacement expression is introduced. */
function styleMaterial(original, meshName, options) {
  const material = new MeshStandardNodeMaterial().copy(original);
  material.name = original.name + '-V1ReferenceStyle';
  if (meshName === 'AvatarHead') {
    const sampled = original.map ? texture(original.map).rgb : materialColor.rgb;
    const luminance = sampled.dot(vec3(0.2126, 0.7152, 0.0722));
    const regions = attribute('avatarFaceStyle', 'vec3');
    const hair = regions.x.mul(float(1).sub(smoothstep(0.12, 0.34, luminance))).max(regions.y);
    const softened = original.map ? mix(materialColor.rgb, texture(original.map).level(1.6).rgb, options.skinSmoothing ?? 0.52) : materialColor.rgb;
    const tan = softened.mul(vec3(...(options.skinTint ?? [0.91, 0.73, 0.56])));
    const darkHair = vec3(0.16, 0.17, 0.18).mul(luminance.min(0.16));
    material.colorNode = mix(tan, darkHair, hair.mul(options.hairDarkening ?? 0.98));
    material.roughness = 0.76;
    material.roughnessNode = mix(float(0.76), float(0.96), hair);
    material.normalScale?.multiplyScalar(0.55);
  } else if (/Eyeball/.test(meshName)) {
    const sampled = original.map ? texture(original.map).rgb : materialColor.rgb;
    // Preserve white sclera and the pupil. Only the chromatic dark iris is
    // shifted toward brown, retaining native radial detail and catchlights.
    const maximum = sampled.r.max(sampled.g).max(sampled.b), minimum = sampled.r.min(sampled.g).min(sampled.b);
    const saturation = maximum.sub(minimum).div(maximum.add(0.0001));
    const iris = smoothstep(0.08, 0.22, saturation).mul(float(1).sub(smoothstep(0.22, 0.50, maximum)));
    const brightness = sampled.dot(vec3(0.2126, 0.7152, 0.0722));
    material.colorNode = mix(materialColor.rgb, vec3(1.28, 0.62, 0.24).mul(brightness), iris);
    material.roughness = 0.20;
  } else if (/Eyelashes/.test(meshName)) material.color.setRGB(0.008, 0.006, 0.005);
  material.needsUpdate = true;
  return material;
}

function pixelsFor(textureValue) {
  const image = textureValue?.image;
  if (!image) return null;
  if (image.data && image.width && image.height) return image;
  try {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(image.width, image.height)
      : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: image.width, height: image.height }) : null;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height);
  } catch { return null; }
}

function preserveReferenceHair(body, options) {
  // Default to one continuous native scalp. The first real render rejected
  // the extracted V1 cap because it produced two hairlines and temple fins.
  if (options.referenceHair !== true) return { meshes: [], triangles: 0, sampled: false, dispose() {} };
  const head = body.bones.get('head'), inverse = metricFrame(head).invert(), extras = [];
  let triangles = 0, sampled = false;
  for (const source of body.meshes.filter(mesh => mesh.isSkinnedMesh)) {
    const material = Array.isArray(source.material) ? source.material[0] : source.material;
    const pixels = pixelsFor(material?.map), uv = source.geometry.attributes.uv;
    // A textureless fixture cannot distinguish black hair from V1's skin.
    if (!pixels || !uv) continue;
    sampled = true; source.skeleton.update();
    const points = Array.from({ length: source.geometry.attributes.position.count }, (_, index) => source.getVertexPosition(index, V()).applyMatrix4(source.matrixWorld).applyMatrix4(inverse));
    const dark = index => {
      const u = uv.getX(index), v = material.map.flipY ? 1 - uv.getY(index) : uv.getY(index);
      const x = Math.max(0, Math.min(pixels.width - 1, Math.floor(u * pixels.width)));
      const y = Math.max(0, Math.min(pixels.height - 1, Math.floor(v * pixels.height)));
      const offset = (y * pixels.width + x) * 4, [r, g, b] = pixels.data.subarray(offset, offset + 3);
      return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255 < 0.24 && Math.max(r, g, b) < 110;
    };
    const indices = source.geometry.index?.array ?? Array.from({ length: points.length }, (_, i) => i), selected = [];
    for (let i = 0; i < indices.length; i += 3) {
      const ids = [indices[i], indices[i + 1], indices[i + 2]], center = ids.reduce((sum, id) => sum.add(points[id]), V()).multiplyScalar(1 / 3);
      const hairZone = center.y > 0.153 || (center.y > 0.090 && center.z < 0.010) || (center.y > 0.127 && Math.abs(center.x) > 0.067);
      if (hairZone && ids.every(dark)) selected.push(...ids);
    }
    if (!selected.length) continue;
    const geometry = source.geometry.clone(); geometry.setIndex(selected); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = source.clone(false); mesh.geometry = geometry; mesh.name = 'HybridReferenceQuiff'; mesh.userData.hybridReferenceHair = true;
    source.parent.add(mesh); extras.push(mesh); triangles += selected.length / 3;
  }
  return { meshes: extras, triangles, sampled, dispose() { for (const mesh of extras) { mesh.removeFromParent(); mesh.geometry.dispose(); } } };
}

/** Native V2 face topology and complete blendshape vocabulary, sculpted toward
 * the V1 visual reference. The visible body and animation rig remain V1. */
export function createSculptedFace(body, donor, options = {}) {
  body.root.updateWorldMatrix(true, true); body.root.updateMatrixWorld(true);
  const hair = preserveReferenceHair(body, options), mounted = mountReplacementHead(body, donor, options);
  const materials = [], meshStats = [];
  try {
    mounted.refresh();
    for (const mesh of mounted.meshes) {
      meshStats.push(sculptMesh(mesh, mounted.bones.get('head'), options));
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(original => { const result = styleMaterial(original, mesh.name, options); materials.push(result); return result; })
        : (() => { const result = styleMaterial(mesh.material, mesh.name, options); materials.push(result); return result; })();
    }
  } catch (error) { for (const material of materials) material.dispose(); hair.dispose(); mounted.dispose(); throw error; }
  const face = new FaceRig(mounted.model), anchor = V(), other = V();
  const stats = { ...mounted.stats, stage: 'native-topology-sculpted-face', targets: face.shapes.size,
    mapping: 'coherent native vertex endpoint sculpture; no surface transfer', meshStats,
    referenceQuiffTriangles: hair.triangles, referenceQuiffTextureSampled: hair.sampled,
    style: { broaderCheeksJaw: true, warmTanSkin: true, darkHairBrowsBeard: true, brownIris: true },
    topologyUnchanged: true, nativeMouthEyelidsTeethPreserved: true, visualQuality: 'requires local real-render review' };
  let disposed = false;
  return { face, stats, mounted,
    update() { if (!disposed) mounted.updatePose?.(); },
    eyes() {
      mounted.refresh();
      const left = mounted.bones.get('lefteye'), right = mounted.bones.get('righteye');
      if (left && right) return left.getWorldPosition(anchor).add(right.getWorldPosition(other)).multiplyScalar(0.5);
      return mounted.bones.get('head').getWorldPosition(anchor).add(V().set(0, 0.053, 0.105).applyQuaternion(mounted.bones.get('head').getWorldQuaternion(Q())));
    },
    dispose() { if (disposed) return; disposed = true; for (const material of materials) material.dispose(); hair.dispose(); mounted.dispose(); },
  };
}
