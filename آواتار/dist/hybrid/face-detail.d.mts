import type { Camera, Mesh, Object3D, Scene, SkinnedMesh, WebGLRenderer } from 'three';

export interface HybridFaceDetailMeshes {
  readonly meshes: readonly Mesh[];
  readonly depthOccluder?: SkinnedMesh;
}

/** Resolve the visible face and original shirt from a mounted Hybrid instance. */
export function getHybridFaceDetailMeshes(root: Object3D): HybridFaceDetailMeshes;

/** Render a cropped face tile to the host's current depth-enabled target.
 * The isolated layer selects this avatar and the host's intended lights.
 * Use a transparent clear color with depth/color clears enabled.
 */
export function renderHybridFaceTile(
  renderer: WebGLRenderer, scene: Scene, camera: Camera, subject: HybridFaceDetailMeshes, layer: number,
): void;
