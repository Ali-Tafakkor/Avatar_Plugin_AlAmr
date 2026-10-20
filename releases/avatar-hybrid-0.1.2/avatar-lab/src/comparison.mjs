import { createPlayerController, DEFAULT_PLAYER_MOVEMENT_CONFIG } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { LOCOMOTION_PROFILE } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';

export const AVATAR_IDS = Object.freeze(['v1', 'v2']);
export const START_POSITIONS = Object.freeze({ v1: Object.freeze([-1.25, 0, 0]), v2: Object.freeze([1.25, 0, 0]) });
export const MOVEMENT_PROFILES = Object.freeze({
  v1: DEFAULT_PLAYER_MOVEMENT_CONFIG,
  v2: Object.freeze({ ...DEFAULT_PLAYER_MOVEMENT_CONFIG, walkSpeed: LOCOMOTION_PROFILE.walkSpeed,
    sprintSpeed: LOCOMOTION_PROFILE.runSpeed, jumpSpeed: 5.6, gravity: 18.8, acceleration: 12, deceleration: 16 }),
});

// One input/camera owner, with independent persistent world poses for both actors.
export function createComparisonSession() {
  const controllers = Object.fromEntries(AVATAR_IDS.map(id => [id,
    createPlayerController({ position: [...START_POSITIONS[id]], yaw: 0 })]));
  let active = 'v2';
  function releaseInput() { for (const controller of Object.values(controllers)) controller.resetInput(); }
  function park(id) {
    const controller = controllers[id];
    const pose = controller.getPoseSnapshot();
    controller.setPose({ ...pose, position: [pose.position[0], 0, pose.position[2]],
      velocity: [0, 0, 0], mode: 'grounded', orientation: undefined, landingRequested: false });
  }
  function reset() {
    releaseInput();
    for (const id of AVATAR_IDS) {
      const controller = controllers[id];
      controller.teleport([...START_POSITIONS[id]], 0);
      park(id);
      controller.setCamera({ ...controller.getCameraSnapshot(), yaw: Math.PI, pitch: 0.06,
        distance: 5.8, mode: 'third-person', firstPersonBlend: 0 });
    }
  }
  reset();
  return {
    controllers,
    get active() { return active; },
    get controller() { return controllers[active]; },
    select(id) {
      if (!AVATAR_IDS.includes(id)) throw new Error('Unknown avatar');
      if (id === active) return active;
      releaseInput(); park(active); active = id;
      return active;
    },
    toggle() { return this.select(active === 'v1' ? 'v2' : 'v1'); },
    releaseInput, reset,
  };
}
