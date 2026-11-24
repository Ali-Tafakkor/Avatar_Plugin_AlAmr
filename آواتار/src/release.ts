// Public entry for the single supported character. The legacy rigs and clips
// remain internal inputs to Hybrid and the local comparison tools.
export { AvatarHybrid, createHybridRuntime, AVATAR_HYBRID_LEGACY_MODEL_URL,
  AVATAR_HYBRID_MODEL_URL, AVATAR_HYBRID_MOTIONS_URL, AVATAR_HYBRID_TEXTURE_URL,
  AVATAR_HYBRID_FACE_ALBEDO_URL, AVATAR_HYBRID_HEIGHT } from './hybrid.js';
export type { AvatarHybridHandle, AvatarHybridProps, AvatarHybridStatus, HybridRuntime, HybridRuntimeOptions,
  HybridClip, HybridPlayback, HybridFaceOptions, HybridManualGroup, HybridStatus, HybridBodyStatus,
  HybridActor, HybridFaceRig, SpeechFrameOptions, SpeechOptions, SpeechStatus } from './hybrid.js';
export { EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE } from './web-v2/runtime.mjs';
export type { AvatarV2Controller, AvatarV2Locomotion, AvatarV2Navigation, EmotionName, PoseFrame } from './v2.js';
export { AVATAR03_CLIPS, MOTION_CLIPS, Avatar03Animator } from './motion.js';
export type { Avatar03Clip, AvatarMotion, MotionState, AnimationStatus } from './motion.js';
export type { Avatar03Lighting } from './model.js';
export { createMicrophoneSpeechController, LaughterDetector, SPEECH_WORKER_URL, SPEECH_CAPTURE_WORKLET_URL,
  DEFAULT_LAUGHTER_WORKER_URL } from './speech/index.js';
export type { MicrophoneSpeechController, MicrophoneSpeechOptions, MicrophoneSpeechStatus,
  MicrophoneSpeechFrame, LaughterDetectorOptions, LaughterResult, LaughterStatus } from './speech/index.js';
export { getHybridFaceDetailMeshes, renderHybridFaceTile } from './hybrid/face-detail.mjs';
export type { HybridFaceDetailMeshes } from './hybrid/face-detail.mjs';
