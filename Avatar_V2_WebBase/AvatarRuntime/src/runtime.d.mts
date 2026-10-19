import type { Camera, Group, Object3D } from 'three';
export type EmotionName = 'neutral' | 'smile' | 'laugh' | 'sad' | 'angry' | 'surprise';
export type FaceOptions = { blinkEnabled?: boolean; gazeEnabled?: boolean; microEnabled?: boolean; ikEnabled?: boolean };
export type AvatarV2Status = {
  ready: boolean; state: string; clip: string; time: number; duration: number; emotion: EmotionName; intensity: number;
  weights: Record<string, number>; morphCount: number; matchedBones: number; missingShapes: string[];
  stats: { vertices: number; triangles: number; meshes: number; textures: number };
  feet: Record<string, { ankle: number[]; soleMinY: number; soleMaxY: number; heelY: number; toeY: number; normal: number[]; rollDeg: number; pitchDeg: number; sampleCount: number }>;
  knees: Record<string, { hip: number[]; knee: number[]; ankle: number[]; flexDeg: number; forwardBend: number; lateralBend: number; planeDeviationDeg: number; upperLength: number; lowerLength: number }>;
  profile: Record<string, number>; disposed: boolean;
};
export type PoseFrame = {
  pose: { position: readonly number[]; velocity: readonly number[]; yaw: number; mode: string };
  locomotion: { state: string; horizontalSpeed: number; verticalSpeed: number; grounded: boolean };
  camera: Camera; portrait?: boolean;
};
export interface WebAvatarRuntime {
  root: Group;
  actor: any;
  director: any;
  expressions: any;
  update(delta: number, frame: PoseFrame): void;
  setEmotion(name: EmotionName): void;
  setManual(group: string, value: number): void;
  setIntensity(value: number): void;
  setFaceOptions(value: FaceOptions): void;
  blink(): void;
  reset(): void;
  getStatus(): AvatarV2Status;
  dispose(): void;
}
export function createWebAvatarRuntime(gltf: unknown, motionPack: unknown, options?: {
  height?: number; lighting?: 'scene' | 'unlit'; groundAt?: (x: number, z: number, maxY?: number) => number;
}): Promise<WebAvatarRuntime>;
export const EMOTIONS: Record<EmotionName, { label: string; key: string; icon: string; values: Record<string, number> }>;
export const FACE_GROUPS: Record<string, string[]>;
export const LOCOMOTION_PROFILE: { walkSpeed: number; runSpeed: number; [key: string]: number };
