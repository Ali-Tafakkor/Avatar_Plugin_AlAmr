import { type ReactNode } from 'react';
import { type Avatar03Lighting } from './model.js';
export type { Avatar03Lighting } from './model.js';
import { type AnimationStatus, type Avatar03Clip, type AvatarMotion } from './motion.js';
export { AvatarWebV2, AVATAR_V2_MODEL_URL, AVATAR_V2_MOTIONS_URL, AVATAR_V2_HEIGHT, EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE, createWebAvatarRuntime } from './v2.js';
export type { AvatarWebV2Handle, AvatarWebV2Props, AvatarV2Locomotion, AvatarV2Controller, AvatarV2Navigation, AvatarV2Status, EmotionName, WebAvatarRuntime, PoseFrame } from './v2.js';
export { AVATAR03_CLIPS, MOTION_CLIPS, Avatar03Animator } from './motion.js';
export type { Avatar03Clip, AvatarMotion, MotionState, AnimationStatus } from './motion.js';
export declare const AVATAR03_MODEL_URL: string;
export declare const AVATAR03_HEIGHT = 1.78;
export interface Avatar03Ready {
    height: number;
    clips: string[];
    meshCount: number;
}
export interface Avatar03Handle {
    setLocomotion(motion: AvatarMotion): void;
    previewClip(clip: Avatar03Clip | null): void;
    getStatus(): AnimationStatus | null;
}
export interface Avatar03Props {
    /** A bundler-resolved local asset URL; defaults to the model shipped in this package. */
    modelUrl?: string;
    textureUrl?: string;
    height?: number;
    rotationY?: number;
    castShadow?: boolean;
    /** Scene lighting preserves the authored material; unlit previews the baked texture. */
    lighting?: Avatar03Lighting;
    onReady?: (ready: Avatar03Ready) => void;
    children?: ReactNode;
}
/** Mount as the official PlayerRig's avatar ReactNode, inside the host's Canvas/Suspense. */
export declare const Avatar03: import("react").ForwardRefExoticComponent<Avatar03Props & import("react").RefAttributes<Avatar03Handle>>;
