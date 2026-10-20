import { AnimationMixer, Box3, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SkinnedMesh, Vector3, type Material } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export type Avatar03Lighting = 'scene' | 'unlit';

/** Prepare an instance without modifying the loader's cached scene or source GLB. */
export function createAvatar03Instance(gltf: Pick<GLTF, 'scene' | 'animations'>, height: number, lighting: Avatar03Lighting) {
  if (!Number.isFinite(height) || height <= 0) throw new Error('avatar03_invalid_height');
  const stand = gltf.animations.find(clip => clip.name === 'Stand');
  if (!stand) throw new Error('avatar03_missing_stand');
  const model = clone(gltf.scene);
  const ownedMaterials: Material[] = [];
  const meshes: Mesh[] = [];
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    meshes.push(object);
    const copy = (material: Material) => {
      // The lab can compare the original surface lighting with the texture alone.
      const result = lighting === 'unlit' && material instanceof MeshStandardMaterial
        ? new MeshBasicMaterial({ map: material.map, color: material.color, side: material.side,
          transparent: material.transparent, opacity: material.opacity, alphaTest: material.alphaTest })
        : material.clone();
      ownedMaterials.push(result);
      return result;
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    object.frustumCulled = false;
  });

  // The bind pose is centered at the hips; the animation moves the hips up.
  // Normalize the standing animation instead, so playback starts on the floor.
  const sampler = new AnimationMixer(model);
  sampler.clipAction(stand).play();
  sampler.update(0);
  model.updateMatrixWorld(true);
  for (const mesh of meshes) if (mesh instanceof SkinnedMesh) mesh.skeleton.update();
  const bounds = new Box3().setFromObject(model, true);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('avatar03_invalid_model_bounds');
  const center = bounds.getCenter(new Vector3());
  sampler.stopAllAction();
  sampler.uncacheRoot(model);
  model.position.add(new Vector3(-center.x, -bounds.min.y, -center.z));
  const root = new Group();
  root.name = 'Avatar03-normalized';
  root.scale.setScalar(height / size.y);
  root.add(model);
  return { model, root, meshes, dispose() {
    for (const material of ownedMaterials) material.dispose();
    for (const mesh of meshes) if (mesh instanceof SkinnedMesh) mesh.skeleton.dispose();
    // Geometry and textures belong to useLoader's shared, single-model cache.
  } };
}
