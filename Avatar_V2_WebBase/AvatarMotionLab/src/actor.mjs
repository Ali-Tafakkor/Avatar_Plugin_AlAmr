import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FaceRig } from './expressions.mjs';
import { clamp } from './math.mjs';

export function boneName(name) {
  let n = name.split(/[|:]/).pop().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(mixamorig|ccbase|bip001|armature)/, '');
  const aliases = { pelvis: 'hips', lthigh: 'leftupleg', rthigh: 'rightupleg', lcalf: 'leftleg', rcalf: 'rightleg',
    lupperarm: 'leftarm', rupperarm: 'rightarm', lforearm: 'leftforearm', rforearm: 'rightforearm',
    eyeleft: 'lefteye', eyeright: 'righteye', eyel: 'lefteye', eyer: 'righteye' };
  return aliases[n] || n;
}
export async function loadActor(renderer, scene, onProgress = () => {}) {
  const loader = new GLTFLoader(), draco = new DRACOLoader(); draco.setDecoderPath('./vendor/draco/');
  loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('./assets/avatar.glb', e => onProgress(e.loaded, e.total));
  const root = new THREE.Group(); root.name = 'ControlledAvatar'; scene.add(root);
  const model = gltf.scene; root.add(model); model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model), height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height < 0.01) throw new Error('The avatar has invalid bounds.');
  model.scale.multiplyScalar(1.78 / height); model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  model.position.x -= (bounds.min.x + bounds.max.x) * 0.5;
  model.position.z -= (bounds.min.z + bounds.max.z) * 0.5;
  model.position.y -= bounds.min.y; root.updateMatrixWorld(true);
  const bones = new Map(), meshes = []; const stats = { vertices: 0, triangles: 0, meshes: 0, textures: 0 };
  const textureSet = new Set();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  model.traverse(node => {
    if (node.isBone) bones.set(boneName(node.name), node);
    if (!node.isMesh) return;
    meshes.push(node); stats.meshes++; stats.vertices += node.geometry.attributes.position?.count || 0;
    stats.triangles += (node.geometry.index?.count || node.geometry.attributes.position?.count || 0) / 3;
    node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false;
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!m) continue;
      if (m.isMeshStandardMaterial) { m.envMapIntensity = 0.72; m.metalness = Math.min(m.metalness, 0.12); }
      const name = `${node.name} ${m.name}`.toLowerCase();
      if (/skin|head|body/.test(name) && m.isMeshStandardMaterial && !/cloth|shirt|pant/.test(name)) m.roughness = clamp(m.roughness, 0.48, 0.86);
      if (/cornea|eyeball|eye_.*material/.test(name) && !/lash|brow/.test(name)) m.roughness = 0.18;
      if (/lash|hair|brow/.test(name) && m.transparent) { m.alphaTest = Math.max(m.alphaTest, 0.12); m.depthWrite = true; }
      for (const v of Object.values(m)) if (v?.isTexture) { v.anisotropy = anisotropy; textureSet.add(v); }
    }
  });
  stats.textures = textureSet.size;
  const required = ['hips', 'head', 'leftupleg', 'leftleg', 'leftfoot', 'rightupleg', 'rightleg', 'rightfoot'];
  const missing = required.filter(name => !bones.has(name));
  if (missing.length) throw new Error('The avatar skeleton is missing required bones: ' + missing.join(', '));
  const face = new FaceRig(model);
  if (face.bindings.length === 0) throw new Error('This avatar does not contain facial morph targets.');
  const rest = new Map([...bones.values()].map(b => [b.uuid, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
  const ankleOffsets = {};
  for (const side of ['left', 'right']) ankleOffsets[side] = clamp(bones.get(side + 'foot').getWorldPosition(new THREE.Vector3()).y, 0.025, 0.16);
  const eyePosition = new THREE.Vector3();
  function eyes() {
    const left = bones.get('lefteye'), right = bones.get('righteye');
    if (left && right) eyePosition.copy(left.getWorldPosition(new THREE.Vector3())).add(right.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    else eyePosition.copy(bones.get('head').getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.115, 0.055).applyQuaternion(root.quaternion));
    return eyePosition;
  }
  return { root, model, bones, rest, meshes, face, stats, ankleOffsets, eyes,
    restore() { for (const b of bones.values()) { const r = rest.get(b.uuid); b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); } root.updateMatrixWorld(true); },
    setWireframe(value) { for (const mesh of meshes) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.wireframe = value; }
  };
}
