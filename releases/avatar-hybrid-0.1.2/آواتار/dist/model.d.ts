import { Group, Mesh, type Material } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
export type Avatar03Lighting = 'scene' | 'unlit';
/** Prepare an instance without modifying the loader's cached scene or source GLB. */
export declare function createAvatar03Instance(gltf: Pick<GLTF, 'scene' | 'animations'>, height: number, lighting: Avatar03Lighting): {
    model: import("three").Object3D<import("three").Object3DEventMap>;
    root: Group<import("three").Object3DEventMap>;
    meshes: Mesh<import("three").BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>, Material<import("three").MaterialEventMap> | Material<import("three").MaterialEventMap>[], import("three").Object3DEventMap>[];
    dispose(): void;
};
