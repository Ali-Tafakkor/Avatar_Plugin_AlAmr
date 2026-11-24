/** DESIGN CONTRACT ONLY. The reference-project does not implement this factory yet.
 * Implement it in the new host and run lifecycle/independence tests before claiming support.
 * Three.js is a host peer dependency; match its pinned runtime/addon versions.
 */
import type { Object3D, Scene, Vector3 } from 'three';
export type Emotion = 'neutral' | 'smile' | 'laugh' | 'sad' | 'angry' | 'surprise';
export type CameraMode = 'portrait' | 'follow' | 'orbit';
export interface MoveInput {
  x: number;                 // -1..1, strafe in the camera-relative plane
  forward: number;           // -1..1
  run: boolean;
  jumpPressed: boolean;      // rising edge, not held-key state
  cameraYawRadians: number;
}
export interface SupportHit { point: Vector3; normal: Vector3; colliderId: string; }
export interface CollisionAdapter {
  /** Host-specific grounded-motion solve; do not implement this with an unchecked teleport. */
  moveCharacter(request: {
    position: Vector3; displacement: Vector3;
    radiusMeters: number; heightMeters: number; stepHeightMeters: number;
  }): { position: Vector3; supported: boolean; ceilingHit: boolean };
  supportAt(position: Vector3, maxDropMeters: number): SupportHit | null;
}
export interface AvatarDependencies {
  scene: Scene;
  /** Optional borrowed renderer; avatar core never renders/disposes it.
   * Material adapter must document WebGL/WebGPU support separately. */
  renderer?: unknown;
  controlMode: 'host-pose' | 'standalone-controller';
  world?: CollisionAdapter; // required for standalone-controller; borrowed support adapter in host-pose
  assetBaseUrl: string;
  signal?: AbortSignal;
  onProgress?: (event: { phase: string; loadedBytes?: number; totalBytes?: number }) => void;
  onDiagnostic?: (event: { level: 'info'|'warning'|'error'; code: string; message: string }) => void;
}
export interface AvatarInspection {
  id: string;
  assetSha256: string | null;
  movementState: string;
  positionMeters: [number,number,number];
  speedMps: number;
  grounded: boolean;
  emotion: Emotion;
  missingBones: string[];
  missingFaceChannels: string[];
  ambiguousMappings: string[];
  finalExpressionWeights: Record<string,number>;
  contact: Record<string, { heelGapMeters: number | null; forefootGapMeters: number | null;
    maxPenetrationMeters: number | null; limited: boolean; active: boolean }>;
  handCapabilities: Record<string, { articulatedDigits: string[]; poseOwner: string }>;
  disposed: boolean;
}
export interface AvatarRuntime {
  readonly root: Object3D;
  /** Only for standalone-controller mode. Host-pose obtains input from its host. */
  setInput(input: MoveInput): void;
  /** Host calls once per display frame; runtime owns only its bounded fixed-step accumulator.
   * Do not also advance the same controller/mixer elsewhere in the host.
   */
  update(deltaSeconds: number, hostFrame?: {
    positionMeters: [number,number,number]; yawRadians: number;
    velocityMps: [number,number,number]; grounded: boolean;
    state: string; // host-pose consumes this; never advances another world controller
  }): void;
  previewMotion(role: string | null): void;
  /** Clears preview overrides before real movement/jump resumes. */
  resumeLocomotion(): void;
  setExpression(emotion: Emotion, intensity?: number): void;
  setFaceOverride(channel: string, value: number | null): void;
  clearFaceOverrides(): void;
  blink(): void;
  setGazeTarget(worldPoint: Vector3 | null): void;
  reset(options?: { positionMeters?: [number,number,number]; yawRadians?: number; resetFace?: boolean }): void;
  getAnchors(): { eyes: Vector3; head: Vector3; body: Vector3 };
  inspect(): AvatarInspection;
  /** Idempotent; releases only instance-owned resources/listeners. */
  dispose(): void;
}
/** Implement this factory; declaration alone provides no runtime behavior.
 * Validate profile against avatar-profile.schema.json before initialization.
 * Camera and keyboard adapters remain optional separate host components.
 */
export declare function createAvatar(
  profile: Readonly<Record<string, unknown>>,
  dependencies: AvatarDependencies
): Promise<AvatarRuntime>;
