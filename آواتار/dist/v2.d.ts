import { type AvatarV2Status, type EmotionName, type WebAvatarRuntime, type PoseFrame } from './web-v2/runtime.mjs';
/** Structural public subsets: the host supplies its controller/navigation.
 * The Plugin does not import or mount another Plugin internally. */
export type AvatarV2Locomotion = PoseFrame['locomotion'];
export interface AvatarV2Controller {
    getPoseSnapshot(): PoseFrame['pose'];
}
export interface AvatarV2Navigation {
    sampleGround(point: readonly [number, number, number]): {
        readonly position: readonly number[];
    } | null | undefined;
}
export declare const AVATAR_V2_MODEL_URL: string;
export declare const AVATAR_V2_MOTIONS_URL: string;
export declare const AVATAR_V2_HEIGHT = 1.78;
export { createWebAvatarRuntime, EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE } from './web-v2/runtime.mjs';
export type { AvatarV2Status, EmotionName, WebAvatarRuntime, PoseFrame } from './web-v2/runtime.mjs';
type FaceOptions = Parameters<WebAvatarRuntime['setFaceOptions']>[0];
type ManualGroup = Parameters<WebAvatarRuntime['setManual']>[0];
export interface AvatarWebV2Handle {
    setLocomotion(locomotion: AvatarV2Locomotion): void;
    setEmotion(name: EmotionName): void;
    setManual(group: ManualGroup, value: number): void;
    setIntensity(value: number): void;
    setFaceOptions(options: FaceOptions): void;
    blink(): void;
    reset(): void;
    getStatus(): AvatarV2Status | null;
    /** Test-Environment inspection only; never replaces the injected platform bridge. */
    getRuntime(): WebAvatarRuntime | null;
}
export interface AvatarWebV2Props {
    controller: AvatarV2Controller;
    navigation: AvatarV2Navigation;
    modelUrl?: string;
    motionsUrl?: string;
    height?: number;
    lighting?: 'scene' | 'unlit';
    portrait?: boolean;
    /** PI aligns the anatomical +Z forward with the official Player Rig's -Z. */
    rotationY?: number;
    onReady?: (status: AvatarV2Status) => void;
    onError?: (error: Error) => void;
}
/** The Environment owns movement/camera; the extracted runtime owns bones and face. */
export declare const AvatarWebV2: import("react").ForwardRefExoticComponent<AvatarWebV2Props & import("react").RefAttributes<AvatarWebV2Handle>>;
