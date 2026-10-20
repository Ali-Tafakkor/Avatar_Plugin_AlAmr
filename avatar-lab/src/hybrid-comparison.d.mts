import type { PlayerMovementConfig } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import type { AvatarId } from './comparison.mjs';
import type { Avatar03Handle, AvatarHybridHandle } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
export const HYBRID_MOVEMENT_PROFILES: Readonly<Record<AvatarId, PlayerMovementConfig>>;
export function resumeComparisonLocomotion(legacy: Pick<Avatar03Handle, 'previewClip'> | null,
  hybrid: Pick<AvatarHybridHandle, 'previewClip' | 'setPlayback'> | null): void;
export function isComparisonLocomotionKey(code: string): boolean;
