import { AnimationMixer, type AnimationClip, type Object3D } from 'three';
export declare const AVATAR03_CLIPS: readonly ["Stand", "Walk", "Run", "Fly", "Jump", "HandRaise", "StandToSit", "Sitting", "SittoStand"];
export type Avatar03Clip = typeof AVATAR03_CLIPS[number];
export type MotionState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'fly';
/** Structural subset of Player Rig 1.0.0's public AvatarLocomotion. */
export interface AvatarMotion {
    readonly state: MotionState;
    readonly horizontalSpeed?: number;
    readonly stridePhase?: number;
}
export declare const MOTION_CLIPS: Readonly<Record<MotionState, Avatar03Clip>>;
export interface AnimationStatus {
    clip: Avatar03Clip;
    mode: 'locomotion' | 'preview';
    sourceState: MotionState;
    fallback: boolean;
    time: number;
    duration: number;
}
/** One mixer per character. It never moves the host's player root or camera. */
export declare class Avatar03Animator {
    private readonly root;
    readonly mixer: AnimationMixer;
    private actions;
    private current;
    private clip;
    private motion;
    private manual;
    private disposed;
    constructor(root: Object3D, clips: readonly AnimationClip[]);
    private configure;
    private switchTo;
    setMotion(motion: AvatarMotion): void;
    preview(name: Avatar03Clip | null): void;
    update(delta: number): void;
    getStatus(): AnimationStatus;
    dispose(): void;
}
