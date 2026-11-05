/** Output order used by wav2arkit. From gsplat-talkinghead, MIT, Navod Peiris (2026).
 * Upstream commit: 5da2574ef3fc9820c3d74cc89e00a0c3c771091a.
 * These are raw semantic channels; rig-specific gain belongs to the compositor. */
export const ARKIT_BLENDSHAPE_NAMES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
  'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
] as const;

export type ArkitBlendshapeName = typeof ARKIT_BLENDSHAPE_NAMES[number];
export type SpeechWeights = Partial<Record<ArkitBlendshapeName, number>>;

export function namedWeights(frame: ArrayLike<number>): SpeechWeights {
  return Object.fromEntries(ARKIT_BLENDSHAPE_NAMES.map((name, index) => {
    const value = frame[index];
    return [name, Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0];
  })) as SpeechWeights;
}
