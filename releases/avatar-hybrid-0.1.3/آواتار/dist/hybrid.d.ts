import { type Group } from 'three';
import type { AvatarV2Controller, AvatarV2Locomotion, AvatarV2Navigation } from './v2.js';
import type { EmotionName } from './web-v2/runtime.mjs';
import { type HybridClip, type HybridFaceOptions, type HybridManualGroup, type HybridPlayback, type HybridRuntime, type HybridStatus, type SpeechFrameOptions, type SpeechOptions } from './hybrid/runtime.mjs';
export { createHybridRuntime } from './hybrid/runtime.mjs';
export type { HybridClip, HybridFaceOptions, HybridManualGroup, HybridPlayback, HybridRuntime, HybridRuntimeOptions, HybridStatus, HybridBodyStatus, HybridActor, HybridFaceRig, SpeechFrameOptions, SpeechOptions, SpeechStatus } from './hybrid/runtime.mjs';
export type AvatarHybridStatus = HybridStatus;
export declare const AVATAR_HYBRID_LEGACY_MODEL_URL: string;
export declare const AVATAR_HYBRID_MODEL_URL: string;
export declare const AVATAR_HYBRID_MOTIONS_URL: string;
export declare const AVATAR_HYBRID_TEXTURE_URL: string;
export declare const AVATAR_HYBRID_HEIGHT = 1.78;
export declare const AVATAR_HYBRID_FACE_ALBEDO_URL: string;
export interface AvatarHybridHandle {
    setLocomotion(value: AvatarV2Locomotion): void;
    previewClip(value: HybridClip | null): void;
    seekClip(seconds: number): void;
    setPlayback(value: HybridPlayback): void;
    setEmotion(name: EmotionName): void;
    setManual(group: HybridManualGroup, value: number): void;
    setIntensity(value: number): void;
    setFaceOptions(options: HybridFaceOptions): void;
    setSpeechFrame(weights: Record<string, number> | null, options?: SpeechFrameOptions): void;
    setSpeechOptions(options: SpeechOptions): void;
    setLaughter(score: number, options?: {
        at?: number;
    }): void;
    clearSpeech(): void;
    setHandPose(pose: string, side?: 'both' | 'left' | 'right'): void;
    setFingerCurl(side: 'both' | 'left' | 'right', digit: string, value: number): void;
    blink(): void;
    reset(): void;
    getStatus(): HybridStatus | null;
    getRoot(): Group | null;
    /** Test-Environment inspection only; the host still owns the platform bridge. */
    getRuntime(): HybridRuntime | null;
}
export interface AvatarHybridProps {
    controller: AvatarV2Controller;
    navigation: AvatarV2Navigation;
    legacyModelUrl?: string;
    modelUrl?: string;
    motionsUrl?: string;
    textureUrl?: string;
    faceAlbedoUrl?: string;
    height?: number;
    lighting?: 'scene' | 'unlit';
    portrait?: boolean;
    rotationY?: number;
    onReady?: (status: HybridStatus) => void;
    onError?: (error: Error) => void;
}
/** The host owns Canvas, navigation, position, heading and camera. This adapter
 * mounts the accepted V1-body/native-V2-face runtime with privately owned state. */
export declare const AvatarHybrid: import("react").ForwardRefExoticComponent<AvatarHybridProps & import("react").RefAttributes<AvatarHybridHandle>>;
