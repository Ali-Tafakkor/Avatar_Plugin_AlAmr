import { BufferAttribute, DataTexture, Group, LinearFilter, Matrix3, Matrix4, Quaternion, RedFormat, UnsignedByteType, Vector3 } from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float, mix, texture } from 'three/tsl';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { boneName } from '../web-v2/actor.mjs';
import { refineNeckGeometry } from './neck-collar.mjs';
import { fitGarmentNeckline } from './garment-neckline.mjs';

const FACE_MESHES = new Set(['AvatarHead', 'AvatarEyelashes', 'AvatarLeftEyeball', 'AvatarRightEyeball', 'AvatarTeethLower', 'AvatarTeethUpper']);
const V = () => new Vector3(), Q = () => new Quaternion();
const metricFrame = head => new Matrix4().compose(head.getWorldPosition(V()), head.getWorldQuaternion(Q()), V().setScalar(1));
const refresh = root => { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); };
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
const isPurple = (r, g, b) => b > g * 1.12 && r > g * 1.04 && b > r * 0.92;

function texturePixels(texture) {
  const image = texture?.image;
  if (!image) return null;
  if (image.data && image.width && image.height) return image;
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(image.width, image.height)
    : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: image.width, height: image.height }) : null;
  if (!canvas) return null;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height);
}

function preservePurple(pixels, uv, indices, texture) {
  // The V1 garment reaches high behind the neck. It must survive independently
  // of the skin-cut plane. Test vertices, edge midpoints and centroid in the
  // untouched source atlas; GLTF's non-flipped V is the image row convention.
  const samples = indices.map(index => [uv.getX(index), uv.getY(index)]);
  samples.push(...indices.map((_, i) => [0, 1].map(axis => (samples[i][axis] + samples[(i + 1) % 3][axis]) / 2)));
  samples.push([0, 1].map(axis => (samples[0][axis] + samples[1][axis] + samples[2][axis]) / 3));
  return samples.some(([u, v]) => {
    if (texture?.flipY) v = 1 - v;
    const x = Math.max(0, Math.min(pixels.width - 1, Math.floor(u * pixels.width)));
    const y = Math.max(0, Math.min(pixels.height - 1, Math.floor(v * pixels.height)));
    const offset = (y * pixels.width + x) * 4, [r, g, b] = pixels.data.subarray(offset, offset + 3);
    return isPurple(r, g, b);
  });
}

function collarMaskMaterial(original, pixels) {
  const values = new Uint8Array(pixels.width * pixels.height);
  for (let i = 0; i < values.length; i++) values[i] = isPurple(...pixels.data.subarray(i * 4, i * 4 + 3)) ? 255 : 0;
  const mask = new DataTexture(values, pixels.width, pixels.height, RedFormat, UnsignedByteType);
  mask.flipY = original.map.flipY; mask.minFilter = LinearFilter; mask.magFilter = LinearFilter;
  mask.generateMipmaps = false; mask.needsUpdate = true;
  const material = original.isMeshBasicMaterial ? new MeshBasicNodeMaterial().copy(original)
    : new MeshStandardNodeMaterial().copy(original);
  material.name = original.name + '-ExactCollarSkinMask';
  material.opacityNode = mix(float(1), texture(mask).r, attribute('hybridRemoveSkin', 'float'));
  material.alphaTest = 0.5; material.transparent = false; material.depthWrite = true; material.needsUpdate = true;
  return { material, mask };
}

function fitNativeNeck(mesh, targetFrame) {
  const inverse = targetFrame.clone().invert(), base = inverse.multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
  const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
  const boneMatrices = mesh.skeleton.bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[i]));
  const positions = mesh.geometry.attributes.position, morphs = mesh.geometry.morphAttributes.position ?? [];
  let affected = 0, maximum = 0;
  for (let index = 0; index < positions.count; index++) {
    const sum = new Array(16).fill(0);
    for (let component = 0; component < 4; component++) {
      const weight = weights.getComponent(index, component), elements = boneMatrices[indices.getComponent(index, component)].elements;
      for (let k = 0; k < 16; k++) sum[k] += weight * elements[k];
    }
    const matrix = base.clone().multiply(new Matrix4().fromArray(sum)).multiply(mesh.bindMatrix);
    const linear = new Matrix3().setFromMatrix4(matrix), intoGeometry = linear.clone().invert();
    const local = V().fromBufferAttribute(positions, index), point = local.clone().applyMatrix4(matrix);
    // The source head includes a broad bare shoulder/bib. V1's shirt collar is
    // narrower, so tuck that lower neck into its opening without touching lips,
    // jaw, eyes or the upper neck. Apply the same endpoint field to all morphs.
    const fit = value => {
      const amount = 1 - smooth(-0.045, -0.008, value.y);
      // Preserve a full anatomical neck rather than compressing it into a
      // throat cone. The unwanted source shoulder flanges are peripheral and
      // rearward, so tuck those down behind the collar instead of shrinking
      // the entire lower neck to fit their widest section.
      const rearWing = amount * smooth(0.045, 0.085, Math.abs(value.x)) * (1 - smooth(-0.015, 0.035, value.z));
      return V().set(value.x * (1 - 0.20 * amount), value.y - 0.020 * rearWing,
        -0.005 + (value.z + 0.005) * (1 - 0.10 * amount));
    };
    const fitted = fit(point), displacement = fitted.clone().sub(point);
    if (displacement.lengthSq() < 1e-16) continue;
    affected++; maximum = Math.max(maximum, displacement.length());
    const updated = local.clone().add(displacement.applyMatrix3(intoGeometry)); positions.setXYZ(index, ...updated.toArray());
    for (const morph of morphs) {
      const delta = V().fromBufferAttribute(morph, index), endpoint = point.clone().add(delta.clone().applyMatrix3(linear));
      const fittedDelta = fit(endpoint).sub(fitted).applyMatrix3(intoGeometry);
      morph.setXYZ(index, ...fittedDelta.toArray());
    }
  }
  positions.needsUpdate = true; for (const morph of morphs) morph.needsUpdate = true;
  mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
  return { affectedVertices: affected, maximumDisplacementMeters: maximum, xScaleAtBase: 0.80, zScaleAtBase: 0.90,
    maximumRearWingLoweringMeters: 0.020 };
}

/** An isolated native V2 face assembly on V1's exact body/animation skeleton.
 * Clones the complete donor skeleton so native skin binding, eye topology and
 * all morph arrays stay coherent. Only its six face meshes remain visible.
 * V1 geometry is only cloned and index-masked; every original attribute and
 * bone is retained. The native neck overlaps the skin cut behind the collar.
 */
export function mountReplacementHead(body, donor, options = {}) {
  const targetHead = body.bones?.get('head'), donorHead = donor.bones?.get('head');
  if (!targetHead || !donorHead || !body.model || !donor.model) throw new Error('hybrid_mount_missing_actor_head');
  const headOffset = options.headOffset ?? [0, 0.035, -0.012];
  const headScale = options.headScale ?? 1;
  const headPitch = options.headPitch ?? -0.08;
  if (!Array.isArray(headOffset) || headOffset.length !== 3 || !headOffset.every(Number.isFinite)
    || !(Number.isFinite(headScale) && headScale > 0) || !Number.isFinite(headPitch)) throw new Error('hybrid_mount_invalid_transform');
  refresh(body.root); donor.refresh?.(); refresh(donor.root);
  const targetFrame = metricFrame(targetHead), donorFrame = metricFrame(donorHead);
  const root = new Group(); root.name = 'HybridReplacementHeadMetric'; root.userData.hybridFaceAssembly = true;
  // Cancel V1's ~94x raw-model scale while following its real head transform.
  root.matrixAutoUpdate = false;
  root.matrix.copy(targetHead.matrixWorld).invert().multiply(targetFrame);
  targetHead.add(root);
  const placement = new Group(); placement.name = 'HybridNativeFacePlacement';
  placement.position.fromArray(headOffset); placement.scale.setScalar(headScale);
  // Native face +Z points forward. Negative X pitch raises that forward axis
  // toward +Y, correcting the source head's downward neutral presentation.
  placement.rotation.x = headPitch; root.add(placement);
  const model = cloneSkeleton(donor.model);
  model.name = 'HybridNativeFaceSkeleton'; model.matrixAutoUpdate = false;
  model.matrix.copy(donorFrame).invert().multiply(donor.model.matrixWorld);
  placement.add(model);
  const meshes = [], bones = new Map(), skeletons = new Set(), geometries = new Map(), materials = new Map(), textures = new Map();
  const discarded = [];
  const cloneTexture = texture => {
    if (!textures.has(texture)) textures.set(texture, texture.clone());
    return textures.get(texture);
  };
  const cloneMaterial = original => {
    if (!materials.has(original)) {
      const material = original.clone();
      for (const [name, value] of Object.entries(material)) if (value?.isTexture) material[name] = cloneTexture(value);
      materials.set(original, material);
    }
    return materials.get(original);
  };
  model.traverse(node => {
    if (node.isBone) { node.userData.hybridFaceBone = true; bones.set(boneName(node.name), node); }
    if (!node.isMesh) return;
    if (node.skeleton) skeletons.add(node.skeleton);
    if (!FACE_MESHES.has(node.name)) { discarded.push(node); return; }
    if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
    node.geometry = geometries.get(node.geometry);
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
    node.frustumCulled = false; node.castShadow = true; node.receiveShadow = true;
    node.userData.hybridFaceMesh = true; meshes.push(node);
  });
  for (const mesh of discarded) mesh.removeFromParent();
  if (meshes.length !== FACE_MESHES.size) { root.removeFromParent(); throw new Error('hybrid_mount_incomplete_native_face'); }
  refresh(body.root);
  const neckFit = fitNativeNeck(meshes.find(mesh => mesh.name === 'AvatarHead'), targetFrame);
  if(options.neckContour!==false)neckFit.refinement=refineNeckGeometry(meshes.find(mesh=>mesh.name==='AvatarHead'),targetFrame);

  const masks = [], garmentNeckline = [], cutY = options.neckCutY ?? -0.085;
  let removedTriangles = 0, preservedGarmentTriangles = 0, conservativeFallback = false, pixelMaskedCollars = 0;
  for (const mesh of body.meshes.filter(item => item.isSkinnedMesh && !item.userData.hybridFaceMesh)) {
    const original = mesh.geometry, geometry = original.clone(), inverse = targetFrame.clone().invert();
    mesh.skeleton.update();
    const points = Array.from({ length: original.attributes.position.count }, (_, index) => mesh.getVertexPosition(index, V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
    const indices = original.index?.array ?? Array.from({ length: points.length }, (_, index) => index);
    const texture = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.map;
    const pixels = texturePixels(texture), uv = original.attributes.uv;
    const keep = [];
    const removal = new Float32Array(points.length);
    // Above the cut plane only original garment texels may remain. This mask
    // resolves mixed garment/skin triangles without retaining tan neck spikes.
    for (let index = 0; index < points.length; index++) removal[index] = smooth(cutY - 0.004, cutY, points[index].y);
    geometry.setAttribute('hybridRemoveSkin', new BufferAttribute(removal, 1));
    const originalMaterial = mesh.material, maskResources = [];
    if (pixels && uv) {
      const masked = collarMaskMaterial(Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial, pixels);
      mesh.material = masked.material; maskResources.push(masked); pixelMaskedCollars++;
    }
    if (!pixels && !options.isClothingTriangle) conservativeFallback = true;
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [indices[i], indices[i + 1], indices[i + 2]];
      const center = triangle.reduce((sum, index) => sum.add(points[index]), V()).multiplyScalar(1 / 3);
      const high = center.y > cutY;
      if (!high) { keep.push(...triangle); continue; }
      const clothing = center.y < -0.015 && (options.isClothingTriangle ? options.isClothingTriangle(mesh, triangle)
        : pixels && uv ? preservePurple(pixels, uv, triangle, texture)
          // Geometry-only fixture fallback keeps the known high side/back
          // collar envelope. Browser use reads the exact original texture.
          : center.z < 0.01 && Math.abs(center.x) < 0.14);
      if (clothing) { preservedGarmentTriangles++; keep.push(...triangle); }
      else removedTriangles++;
    }
    geometry.setIndex(keep); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    mesh.geometry = geometry; masks.push({ mesh, original, geometry, originalMaterial, maskResources });
    if (options.garmentNeckline !== false && mesh.name === 'Meshy_AI_Lilac_Sweatshirt_Port_0809081014_texture')
      garmentNeckline.push(fitGarmentNeckline(mesh, targetFrame));
  }
  refresh(body.root);
  const mountedHead = bones.get('head');
  const headFrame = { position: mountedHead.getWorldPosition(V()), quaternion: mountedHead.getWorldQuaternion(Q()), matrix: metricFrame(mountedHead) };
  const nativeBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const mountedSkin = meshes.find(mesh => mesh.name === 'AvatarHead'), intoTarget = targetFrame.clone().invert();
  for (let index = 0; index < mountedSkin.geometry.attributes.position.count; index++) {
    const point = mountedSkin.getVertexPosition(index, V()).applyMatrix4(mountedSkin.matrixWorld).applyMatrix4(intoTarget);
    for (let axis = 0; axis < 3; axis++) {
      nativeBounds.min[axis] = Math.min(nativeBounds.min[axis], point.getComponent(axis));
      nativeBounds.max[axis] = Math.max(nativeBounds.max[axis], point.getComponent(axis));
    }
  }
  const stats = { stage: 'new-native-topology-face-on-v1-body', sourceFaceMeshes: meshes.map(mesh => mesh.name),
    nativeMorphChannels: new Set(meshes.flatMap(mesh => Object.keys(mesh.morphTargetDictionary ?? {}))).size,
    headOffset: [...headOffset], headScale, headPitch, headPitchDegrees: headPitch * 180 / Math.PI,
    neckCutY: cutY, removedTriangles, preservedGarmentTriangles,
    pixelMaskedCollars, neckFit, garmentNeckline,
    sourceAttributesPreserved: true, originalV1BonesUntouched: true, clonedBonesTagged: bones.size,
    mountedNativeHeadBoundsMeters: nativeBounds,
    conservativeTexturelessFallback: conservativeFallback, neckJoin: 'native neck overlaps V1 skin cut behind original preserved collar',
    sourceHeadFrame: { position: donorHead.getWorldPosition(V()).toArray(), quaternion: donorHead.getWorldQuaternion(Q()).toArray() } };
  const references = { spine2: 'spine2', neck: 'neck', neck1: 'neck', neck2: 'neck',
    leftshoulder: 'leftshoulder', rightshoulder: 'rightshoulder', head: 'head' };
  const depth = node => { let count = 0; while (node.parent) { node = node.parent; count++; } return count; };
  const anchors = Object.entries(references).flatMap(([name, reference]) => {
    const bone = bones.get(name), source = body.bones.get(reference);
    return bone && source ? [{ name, reference, bone, source,
      calibration: source.matrixWorld.clone().invert().multiply(bone.matrixWorld) }] : [];
  }).sort((a, b) => depth(a.bone) - depth(b.bone));
  stats.poseSync = { calibration: 'initial neutral physical world transforms',
    anchors: anchors.map(({ name, reference }) => ({ native: name, v1: reference })),
    headPlacementPreserved: true };
  let disposed = false;
  return { root, model, meshes, bones, headFrame, targetHead, stats,
    refresh() { refresh(body.root); },
    updatePose() {
      if (disposed) return;
      refresh(body.root);
      // The whole assembly is carried by V1 Head. Compensate its lower native
      // bones back to V1 torso/neck anchors, in hierarchy order, then pin the
      // native Head to its original calibrated placement. This avoids double
      // head rotation and lets native neck weights bend with a sitting torso.
      for (const { bone, source, calibration } of anchors) {
        bone.parent.updateWorldMatrix(true, false);
        const desiredWorld = source.matrixWorld.clone().multiply(calibration);
        const local = bone.parent.matrixWorld.clone().invert().multiply(desiredWorld);
        local.decompose(bone.position, bone.quaternion, bone.scale);
        bone.updateMatrix(); bone.updateMatrixWorld(true);
      }
      refresh(body.root);
    },
    dispose() {
      if (disposed) return; disposed = true;
      root.removeFromParent();
      for (const mask of masks) {
        mask.mesh.geometry = mask.original; mask.mesh.material = mask.originalMaterial; mask.geometry.dispose();
        for (const resources of mask.maskResources) { resources.material.dispose(); resources.mask.dispose(); }
      }
      for (const geometry of geometries.values()) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
    },
  };
}
