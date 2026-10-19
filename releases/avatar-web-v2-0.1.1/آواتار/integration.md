# Avatar 03 Web V2 adapter contract — 0.1.1

Local authored contract, not Registry-generated release metadata. Plugin ID,
publisher, slug, contractVersion and runtime compatibility are retained from
0.1.0; only the product release version advances. Semantic adapter: `r3f`,
runtime `react-three-fiber`, export path `.`, host kind `environment`.

The recommended `avatar.character` surface is `AvatarWebV2`. It mounts as a
React node in the consuming Environment's `PlayerRig.avatar` prop. The host
owns Canvas, rendering, camera, controller input, world pose, navigation and
lifetime. This Plugin does not mount or import Player Rig internally. Its
controller/navigation types are structural subsets of public host methods.
No platform ports, identity claims, settings surface, backend or permissions
are required. The host's Three/React/Fiber instances must be shared.

Peers: React >=19 <19.3; Three >=0.185.1 <0.186.0; R3F >=9.6.1 <10.
The complete consuming Environment at ../avatar-lab uses the exact managed
Player Rig 1.0.0 and WebGPURenderer. All resources load from the local bundle.

## Web V2 props and methods

Required props: `controller.getPoseSnapshot()` returns world position,
velocity, yaw and mode; `navigation.sampleGround([x,y,z])` returns a ground
position or no result. Optional props: modelUrl, motionsUrl, height=1.78,
lighting='scene'|'unlit', rotationY=PI, portrait=false, onReady and onError.
Positive finite height is required. Loader errors belong to the host's
Suspense/error boundary; runtime initialization/frame errors reach onError.

Ref AvatarWebV2Handle:
- setLocomotion({state,horizontalSpeed,verticalSpeed,grounded}) receives the
  current public Player Rig onAnimationFrame snapshot.
- setEmotion(neutral|smile|laugh|sad|angry|surprise), setIntensity(0..1).
- setManual(jaw|smile|frown|brows|browDown|wide, 0..1).
- setFaceOptions({blinkEnabled?,gazeEnabled?,microEnabled?,ikEnabled?}).
- blink(), reset(), getStatus(); getRuntime() is for explicit test inspection.

The host supplies current pose before the runtime's frame subscriber runs.
The adapter registers that subscriber after async initialization, at R3F
priority zero; it never takes over host rendering. +Z anatomical forward is
aligned to the official Player Rig's -Z by the default PI rotation. Root
world translation/yaw is not applied a second time.

The extracted actor retains 73 bones, ten meshes and 66 facial shapes. Every
instance clones its mutable skeleton, geometry, materials, textures and
facial influences. Unmount disposes only those resources, stopping and
uncaching its mixer. Standalone runtime dispose is idempotent. reset clears
motion/contact history while preserving facial settings.

The recommended host movement profile is exported as LOCOMOTION_PROFILE:
walkSpeed=2.25 and runSpeed=6.2 m/s. Set the host's walkSpeed/sprintSpeed to
these values; an animation-only Plugin does not change host travel speed.
Knee/sole correction, stride timing and transitions are built into the runtime.

## Packaged assets and exports

Copy the complete dist/assets/avatar-v2 directory to the host's public
avatar-v2 directory, preserving avatar.gltf, avatar.bin, images and motions.json,
and pass their host-local URLs. The executable example's preparation script
does this. A bundler import of only the glTF does not copy sibling images.
The module-relative default URLs work when the package asset layout is kept.

Frontend exports: AvatarWebV2, AVATAR_V2_MODEL_URL, AVATAR_V2_MOTIONS_URL,
AVATAR_V2_HEIGHT, EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE,
createWebAvatarRuntime; plus the preserved legacy exports below. Types are
in dist/index.d.ts, dist/v2.d.ts and dist/web-v2/runtime.d.mts. Public package
subpaths are ./web-v2, ./runtime, ./web-model, ./web-motions and ./web-asset-manifest.

## Compatible legacy API

Avatar03, AVATAR03_CLIPS, AVATAR03_MODEL_URL, AVATAR03_HEIGHT, MOTION_CLIPS and
Avatar03Animator retain the old model/API and nine embedded clips. Its ref
still exposes setLocomotion, previewClip and getStatus. Fall continues Jump;
land uses Stand with fallback status. Existing Avatar03 consumers are not
silently migrated to the new model. Use AvatarWebV2 for this release's new
character. Consumers pinned to published 0.1.0 retain their original bytes.

## Publication and scope

The local Plugin folder is the submit-button source. Both versions are 0.1.1;
no manual npm pack is required. README describes installation after an actual
Registry release exists. The provided local example is not proof of a
published-version installation. A submitted candidate is not a published one.
The model/motion asset permissions in LICENSE and THIRD_PARTY_NOTICES.md are
separate from the application code license. No new commercial permission is
asserted. Real VR pose tracking, remote replication, audio lip-sync and a
platform-wide avatar replacement are outside this release's tested scope.
