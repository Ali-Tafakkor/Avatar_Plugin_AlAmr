import { MOVEMENT_PROFILES } from './comparison.mjs';
import { DEFAULT_PLAYER_INPUT_BINDINGS } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';

// Match the accepted hybrid host: native V1 locomotion and V2 jump physics.
export const HYBRID_MOVEMENT_PROFILES = Object.freeze({
  v1: MOVEMENT_PROFILES.v1,
  v2: Object.freeze({ ...MOVEMENT_PROFILES.v1, jumpSpeed: 5.6, gravity: 18.8 }),
});

// Clip preview overrides locomotion in the runtime. Release that override
// before a real movement action so a jump always uses the V2 jump source.
export function resumeComparisonLocomotion(legacy, hybrid) {
  legacy?.previewClip(null);
  hybrid?.previewClip(null);
  hybrid?.setPlayback({ paused: false, timeScale: 1 });
}

const locomotionKeys = new Set(Object.entries(DEFAULT_PLAYER_INPUT_BINDINGS)
  .filter(([action]) => action !== 'interact').flatMap(([, keys]) => keys));
export function isComparisonLocomotionKey(code) { return locomotionKeys.has(code); }
