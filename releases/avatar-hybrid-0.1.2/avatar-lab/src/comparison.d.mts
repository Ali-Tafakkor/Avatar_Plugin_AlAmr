import type { PlayerController, PlayerMovementConfig } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
export type AvatarId = 'v1' | 'v2';
export const AVATAR_IDS: readonly AvatarId[];
export const START_POSITIONS: Readonly<Record<AvatarId, readonly [number, number, number]>>;
export const MOVEMENT_PROFILES: Readonly<Record<AvatarId, PlayerMovementConfig>>;
export interface ComparisonSession {
  controllers: Record<AvatarId, PlayerController>;
  readonly active: AvatarId;
  readonly controller: PlayerController;
  select(id: AvatarId): AvatarId;
  toggle(): AvatarId;
  releaseInput(): void;
  reset(): void;
}
export function createComparisonSession(): ComparisonSession;
