# Avatar 03 local adapter contract — 0.1.0

Adapter `r3f`, runtime `react-three-fiber`, export path `.`, host kind `environment`.
This is the local authored contract, not Registry-generated release metadata.

Semantic surface: `avatar.character`, exported by `Avatar03`. The Environment
composes this React node into the official `PlayerRig.avatar` prop. There is no
automatic replacement of an installed Environment or cross-Plugin mounting.

Peers: React `>=19 <19.3`, Three `>=0.185.1 <0.186.0`, R3F `>=9.6.1 <10`.
The consuming example uses the exact managed Player Rig 1.0.0 adapter and owns
the WebGPURenderer Canvas, controller, navigation surface and lifetime.

Props: optional `modelUrl`, `textureUrl`, `height` (positive metres; default 1.78), `rotationY`
(radians; default PI aligns with the rig's -Z forward), `castShadow`,
`lighting` (`scene` by default or `unlit` for a texture-only comparison), `onReady`, and `children`. Mount inside Suspense and an
error boundary. Supply a bundler-resolved URL from `./model`; the default model
URL is relative to the packaged module. The build also copies the GLB's sole PNG
unchanged to `dist/assets/avatar03-texture.png`. Keep that asset with the module
or pass its bundled URL as `textureUrl`. A public GLTFLoader plugin binds this
texture without fetching embedded blob URLs in Desktop's isolated protocol.

Ref `Avatar03Handle`:

- `setLocomotion({state, horizontalSpeed?, stridePhase?})`: receive the host's
  public Player Rig snapshot from `onAnimationFrame`.
- `previewClip(name | null)`: inspect an embedded clip or resume host locomotion.
- `getStatus()`: clip, time, duration, source state, mode and fallback flag;
  null until ready. It does not grant control over the host's player state.

Other exports: `AVATAR03_CLIPS`, `AVATAR03_MODEL_URL`, `AVATAR03_HEIGHT`,
`MOTION_CLIPS`, `Avatar03Animator`. Types: `dist/index.d.ts`.

No platform ports, backend, identity, settings or permissions are requested.
Only bundled model and texture assets are loaded. The host retains camera/input/collision.
Embedded clips: Stand, Walk, Run, Fly, Jump, HandRaise, StandToSit, Sitting,
SittoStand. Fall continues Jump; land uses Stand, explicitly reporting fallback.
Non-shared gestures are preview-only until a host adds corresponding commands.

Unmount releases instance-owned animation, materials and skeleton resources.
Geometry and textures remain in the shared single-model loader cache.
Explicit errors: `avatar03_missing_clips`, `avatar03_invalid_height`,
`avatar03_invalid_model_bounds`. Hosts handle loader errors and offer recovery.

Complete runnable consumption example: `../avatar-lab/src/main.tsx`.
For publication, link and publish through the authorized Registry workflow, then
use `alamr add publisher/avatar03@exact-version --adapter r3f` in the host and
follow the install command. Never hand-edit its managed `plugins` list.
The local lab uses a file dependency while this Plugin has no published release.
