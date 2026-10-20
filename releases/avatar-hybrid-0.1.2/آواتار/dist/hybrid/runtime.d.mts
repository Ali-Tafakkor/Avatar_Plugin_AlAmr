import type { Bone, Group, Mesh, Object3D } from 'three';
import type { EmotionName, FaceOptions, PoseFrame, WebAvatarRuntime } from '../web-v2/runtime.mjs';

export type HybridClip = 'Stand' | 'Walk' | 'Run' | 'Fly' | 'HandRaise' | 'StandToSit' | 'Sitting' | 'SittoStand';
export type HybridPlayback = { paused?: boolean; timeScale?: number };
export type HybridManualGroup = 'jaw' | 'smile' | 'frown' | 'brows' | 'browDown' | 'wide';
export type HybridFaceOptions = Pick<FaceOptions, 'blinkEnabled' | 'gazeEnabled' | 'microEnabled'>;
export type HybridRuntimeOptions = {
  height?: number;
  lighting?: 'scene' | 'unlit';
  groundAt?: (x: number, z: number, maxY?: number) => number;
};
export type HybridFootStatus = {
  ankle: number[]; heelY: number; toeY: number; soleMinY: number; soleMaxY: number; sampleCount: number;
};
export type HybridStaticContact = {
  active: boolean; reason: string; clip?: HybridClip;
  feet: Record<string, {
    groundY: number; translationY: number; limited: boolean;
    angleCorrectionDegrees: number; toeCorrectionDegrees: number;
    before: { heelY: number; toeY: number };
    after?: { heelY: number; toeY: number; soleMinY: number; heelResidual: number; toeResidual: number };
  }>;
};
export type HybridBodyStatus = {
  ready: boolean; state: string; clip: string; mode: 'preview' | 'locomotion'; time: number; duration: number;
  activeMotionSource: 'V1-original-native-tracks' | 'V2-jump-retargeted-to-V1';
  jumpWeight: number; staticContact: HybridStaticContact; mappingCount: number; matchedBones: number; rootMotionScale: number;
  clips: { name: HybridClip; duration: number }[];
  feet: Record<string, HybridFootStatus>;
  knees: Record<string, { hip: number[]; knee: number[]; ankle: number[]; flexDeg: number }>;
  stats: { meshes: number; joints: number }; disposed: boolean;
};
export type HybridFaceStats = {
  stage: string; targets: number; nativeMorphChannels: number; sourceFaceMeshes: string[];
  headOffset: number[]; headScale: number; headPitch: number; headPitchDegrees: number;
  topologyUnchanged: boolean; nativeMouthEyelidsTeethPreserved: boolean;
  originalV1BonesUntouched: boolean; visualQuality: string;
  poseSync: { calibration: string; anchors: { native: string; v1: string }[]; headPlacementPreserved: boolean };
  [name: string]: unknown;
};
export type HybridStatus = HybridBodyStatus & {
  emotion: EmotionName; intensity: number; weights: Record<string, number>;
  morphCount: number; missingShapes: string[]; faceTransfer: HybridFaceStats;
  inspectionFace: Record<string, number> | null;
};
export interface HybridFaceRig {
  shapes: Set<string>;
  missing: string[];
  bindings: { node: Mesh; index: number; normalized: string }[];
  apply(weights: Record<string, number>): void;
}
export interface HybridActor {
  root: Group; model: Object3D; bones: Map<string, Bone>; meshes: Mesh[]; face: HybridFaceRig;
  refresh(): void; measureFeet(): Record<string, HybridFootStatus>; dispose(): void;
}
export interface HybridBodyRuntime {
  root: Group; model: Object3D; actor: HybridActor; bones: Map<string, Bone>; meshes: Mesh[];
  instance: { root: Group; model: Object3D; meshes: Mesh[] };
  jumpDonor: WebAvatarRuntime;
  clips: Map<HybridClip, import('three').AnimationClip>;
  update(delta: number, frame: PoseFrame): void;
  previewClip(name: HybridClip | null): void;
  sample(name: HybridClip, time: number): { name: string; time: number; duration: number };
  seekClip(seconds: number): void;
  setPlayback(value: HybridPlayback): void;
  applyStaticContact(frame: PoseFrame): HybridStaticContact;
  refreshGeometryMeasurements(): Record<string, HybridFootStatus>;
  refresh(): void; reset(): void; getStatus(): HybridBodyStatus; dispose(): void;
}
export interface HybridRuntime {
  root: Group; model: Object3D; actor: HybridActor; body: HybridBodyRuntime; face: HybridFaceRig;
  expressions: {
    name: EmotionName; intensity: number; weights: Record<string, number>;
    blinkEnabled: boolean; gazeEnabled: boolean; microEnabled: boolean;
  };
  update(delta: number, frame: PoseFrame): void;
  previewClip(name: HybridClip | null): void;
  seekClip(seconds: number): void;
  setPlayback(value: HybridPlayback): void;
  setEmotion(name: EmotionName): void;
  setManual(group: HybridManualGroup, value: number): void;
  setIntensity(value: number): void;
  setFaceOptions(options: HybridFaceOptions): void;
  blink(): void;
  /** Local inspection only; null restores the normal expression controller. */
  setInspectionFace(weights: Record<string, number> | null): void;
  reset(): void; getStatus(): HybridStatus; dispose(): void;
}
export function createHybridRuntime(legacyGltf: unknown, webGltf: unknown, motions: unknown, options?: HybridRuntimeOptions): Promise<HybridRuntime>;
