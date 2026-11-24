import type { Mesh, Texture } from 'three';
import type { HybridRuntime } from '../../آواتار/dist/hybrid.js';
import type { AvatarPalette } from './avatar-palette';

export function getGarmentBody(runtime: HybridRuntime): (Mesh & { material: { map: Texture } }) | undefined;
export function mountAvatarColors(runtime: HybridRuntime, atlas: Texture, character: string): {
  set(palette: AvatarPalette): void;
  dispose(): void;
};
