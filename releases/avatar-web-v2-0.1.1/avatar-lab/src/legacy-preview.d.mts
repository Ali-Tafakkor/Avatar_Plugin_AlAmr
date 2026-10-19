import type { Object3D } from 'three';
export interface LegacyMaterialAudit { meshes: number; skinnedMeshes: number; materials: number; transparentBefore: number; transparentAfter: number; }
export function fixLegacyPreviewMaterials(root: Object3D): LegacyMaterialAudit;
