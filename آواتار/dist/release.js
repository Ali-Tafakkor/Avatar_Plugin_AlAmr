// Public entry for the single supported character. The legacy rigs and clips
// remain internal inputs to Hybrid and the local comparison tools.
export { AvatarHybrid, createHybridRuntime, AVATAR_HYBRID_LEGACY_MODEL_URL, AVATAR_HYBRID_MODEL_URL, AVATAR_HYBRID_MOTIONS_URL, AVATAR_HYBRID_TEXTURE_URL, AVATAR_HYBRID_FACE_ALBEDO_URL, AVATAR_HYBRID_HEIGHT } from './hybrid.js';
export { EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE } from './web-v2/runtime.mjs';
export { AVATAR03_CLIPS, MOTION_CLIPS, Avatar03Animator } from './motion.js';
export { createMicrophoneSpeechController, LaughterDetector, SPEECH_WORKER_URL, SPEECH_CAPTURE_WORKLET_URL, DEFAULT_LAUGHTER_WORKER_URL } from './speech/index.js';
export { getHybridFaceDetailMeshes, renderHybridFaceTile } from './hybrid/face-detail.mjs';
//# sourceMappingURL=release.js.map