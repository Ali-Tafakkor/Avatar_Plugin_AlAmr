import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { FaceRig } from './expressions.mjs';
import { clamp } from './math.mjs';

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
export function boneName(name) {
  const n = name.split(/[|:]/).pop().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(mixamorig|ccbase|bip001|armature)/, '');
  const aliases = { pelvis: 'hips', lthigh: 'leftupleg', rthigh: 'rightupleg', lcalf: 'leftleg', rcalf: 'rightleg',
    lupperarm: 'leftarm', rupperarm: 'rightarm', lforearm: 'leftforearm', rforearm: 'rightforearm',
    eyeleft: 'lefteye', eyeright: 'righteye', eyel: 'lefteye', eyer: 'righteye' };
  return aliases[n] || n;
}

/** A private skeleton, geometry, material and texture instance; never mutates the cached GLTF. */
export function createActorInstance(gltf, { height = 1.78, lighting = 'scene' } = {}) {
  if (!gltf?.scene || !Number.isFinite(height) || height <= 0) throw new Error('A GLTF scene and a positive avatar height are required.');
  const model = cloneSkeleton(gltf.scene), root = new THREE.Group();
  root.name = 'WebAvatarV2'; root.add(model);
  const bones = new Map(), meshes = [], geometries = new Map(), materials = new Map(), textures = new Map(), skeletons = new Set();
  const cloneTexture = texture => {
    if (!textures.has(texture)) textures.set(texture, texture.clone());
    return textures.get(texture);
  };
  const cloneMaterial = original => {
    if (!materials.has(original)) {
      const material = original.clone();
      for (const [key, value] of Object.entries(material)) if (value?.isTexture) material[key] = cloneTexture(value);
      materials.set(original, material);
    }
    return materials.get(original);
  };
  model.traverse(node => {
    if (node.isBone) bones.set(boneName(node.name), node);
    if (!node.isMesh) return;
    if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
    node.geometry = geometries.get(node.geometry);
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
    if (node.skeleton) skeletons.add(node.skeleton);
    node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false;
    meshes.push(node);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      if (material.isMeshStandardMaterial) {
        material.envMapIntensity = lighting === 'scene' ? 0.72 : 1;
        material.metalness = Math.min(material.metalness, 0.12);
      }
      const name = `${node.name} ${material.name}`.toLowerCase();
      if (/skin|head|body/.test(name) && material.isMeshStandardMaterial && !/cloth|shirt|pant/.test(name)) material.roughness = clamp(material.roughness, 0.48, 0.86);
      if (/cornea|eyeball|eye_.*material/.test(name) && !/lash|brow/.test(name)) material.roughness = 0.18;
      if (/lash|hair|brow/.test(name) && material.transparent) { material.alphaTest = Math.max(material.alphaTest, 0.12); material.depthWrite = true; }
    }
  });
  // SkinnedMesh updates bindMatrixInverse in its updateMatrixWorld override, not in
  // Object3D.updateWorldMatrix. Refresh ancestors first, then traverse that override.
  const refresh = () => { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); };
  refresh();
  let bounds = new THREE.Box3().setFromObject(model), originalHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(originalHeight) || originalHeight < 0.01) throw new Error('The avatar has invalid bounds.');
  model.scale.multiplyScalar(height / originalHeight); refresh();
  bounds = new THREE.Box3().setFromObject(model);
  model.position.x -= (bounds.min.x + bounds.max.x) * 0.5;
  model.position.z -= (bounds.min.z + bounds.max.z) * 0.5;
  model.position.y -= bounds.min.y; refresh();
  const required = ['hips', 'head', 'leftupleg', 'leftleg', 'leftfoot', 'rightupleg', 'rightleg', 'rightfoot'];
  const missing = required.filter(name => !bones.has(name));
  if (missing.length) throw new Error('The avatar skeleton is missing required bones: ' + missing.join(', '));
  const face = new FaceRig(model);
  if (!face.bindings.length) throw new Error('This avatar does not contain facial morph targets.');
  const rest = new Map([...bones.values()].map(b => [b.uuid, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
  const stats = { vertices: 0, triangles: 0, meshes: meshes.length, textures: textures.size };
  for (const mesh of meshes) {
    stats.vertices += mesh.geometry.attributes.position?.count || 0;
    stats.triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position?.count || 0) / 3;
  }
  const footCalibration = {}, ankleOffsets = {};
  const shoes = meshes.filter(mesh => mesh.isSkinnedMesh && /shoe|footwear/i.test(mesh.name));
  for (const side of ['left', 'right']) {
    const foot = bones.get(side + 'foot'), toe = bones.get(side + 'toebase');
    const footQ = foot.getWorldQuaternion(Q()), ankle = foot.getWorldPosition(V());
    const candidates = [];
    for (const mesh of shoes) {
      const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        let weight = 0;
        for (let c = 0; c < 4; c++) {
          const bone = mesh.skeleton.bones[indices.getComponent(i, c)];
          if (bone && boneName(bone.name).startsWith(side)) weight += weights.getComponent(i, c);
        }
        if (weight > 0.9) candidates.push({ mesh, index: i, point: mesh.getVertexPosition(i, V()).applyMatrix4(mesh.matrixWorld) });
      }
    }
    if (!candidates.length) throw new Error(`The ${side} shoe needs a sole calibration mesh.`);
    const minY = Math.min(...candidates.map(v => v.point.y));
    const soleSamples = candidates.filter(v => v.point.y <= minY + height * 0.00675).map(({ mesh, index, point }) => ({ mesh, index, restPoint: root.worldToLocal(point.clone()) }));
    const toeDirection = toe ? toe.getWorldPosition(V()).sub(ankle) : new THREE.Vector3(0, 0, 1);
    const bindHeading = Math.atan2(toeDirection.x, toeDirection.z);
    const toeOut = (side === 'left' ? 1 : -1) * THREE.MathUtils.degToRad(6);
    const flatQuaternion = Q().setFromAxisAngle(new THREE.Vector3(0, 1, 0), toeOut - bindHeading).multiply(footQ);
    footCalibration[side] = { restWorldQuaternion: footQ, flatQuaternion, bindHeading, flatHeading: toeOut,
      toeRestQuaternion: toe ? toe.quaternion.clone() : Q(), soleSamples, originalSoleMinY: minY,
      ankleOffset: ankle.y - minY, shoeVertices: candidates.length };
    ankleOffsets[side] = ankle.y - minY;
  }
  let disposed = false;
  const actor = { root, model, bones, rest, meshes, face, stats, ankleOffsets, footCalibration, refresh,
    restore() {
      for (const b of bones.values()) { const r = rest.get(b.uuid); b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); }
      refresh();
    },
    eyes() {
      refresh();
      const left = bones.get('lefteye'), right = bones.get('righteye');
      if (left && right) return left.getWorldPosition(V()).add(right.getWorldPosition(V())).multiplyScalar(0.5);
      return bones.get('head').getWorldPosition(V()).add(new THREE.Vector3(0, 0.115, 0.055).applyQuaternion(root.getWorldQuaternion(Q())));
    },
    measureFeet() {
      refresh(); const result = {};
      for (const side of ['left', 'right']) {
        const calibration = footCalibration[side], foot = bones.get(side + 'foot');
        const points = calibration.soleSamples.map(sample => sample.mesh.getVertexPosition(sample.index, V()).applyMatrix4(sample.mesh.matrixWorld));
        const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(foot.getWorldQuaternion(Q()).multiply(calibration.restWorldQuaternion.clone().invert()));
        const invRoot = root.getWorldQuaternion(Q()).invert(), localNormal = normal.clone().applyQuaternion(invRoot);
        const anatomicalNormal = localNormal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -calibration.flatHeading);
        const middleZ = calibration.soleSamples.reduce((sum, sample) => sum + sample.restPoint.z, 0) / points.length;
        const heel = points.filter((_, i) => calibration.soleSamples[i].restPoint.z <= middleZ);
        const toes = points.filter((_, i) => calibration.soleSamples[i].restPoint.z > middleZ);
        result[side] = { ankle: foot.getWorldPosition(V()).toArray(), soleMinY: minY, soleMaxY: maxY,
          heelY: Math.min(...heel.map(p => p.y)), toeY: Math.min(...toes.map(p => p.y)), normal: normal.toArray(),
          rollDeg: THREE.MathUtils.radToDeg(Math.atan2(-anatomicalNormal.x, Math.hypot(anatomicalNormal.y, anatomicalNormal.z))),
          pitchDeg: THREE.MathUtils.radToDeg(Math.atan2(anatomicalNormal.z, anatomicalNormal.y)),
          rootRollDeg: THREE.MathUtils.radToDeg(Math.atan2(localNormal.x, localNormal.y)), sampleCount: points.length };
      }
      return result;
    },
    measureKnees() {
      refresh(); const result = {};
      for (const side of ['left', 'right']) {
        const hip = root.worldToLocal(bones.get(side + 'upleg').getWorldPosition(V()));
        const knee = root.worldToLocal(bones.get(side + 'leg').getWorldPosition(V()));
        const ankle = root.worldToLocal(bones.get(side + 'foot').getWorldPosition(V()));
        const upper = knee.clone().sub(hip), lower = ankle.clone().sub(knee), axis = ankle.clone().sub(hip);
        const projection = hip.clone().addScaledVector(axis, knee.clone().sub(hip).dot(axis) / Math.max(axis.lengthSq(), 1e-12));
        const pole = knee.clone().sub(projection), normal = upper.clone().cross(lower).normalize();
        result[side] = { hip: hip.toArray(), knee: knee.toArray(), ankle: ankle.toArray(),
          flexDeg: THREE.MathUtils.radToDeg(upper.angleTo(lower)), forwardBend: pole.z,
          lateralBend: pole.x, planeDeviationDeg: THREE.MathUtils.radToDeg(Math.acos(clamp(normal.x, -1, 1))),
          upperLength: upper.length(), lowerLength: lower.length() };
      }
      return result;
    },
    setWireframe(value) { for (const material of materials.values()) material.wireframe = value; },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      for (const geometry of geometries.values()) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
    }
  };
  return actor;
}

