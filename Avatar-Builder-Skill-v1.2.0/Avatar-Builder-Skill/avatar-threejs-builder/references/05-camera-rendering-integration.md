# 05 — Camera, rendering and integration

No Al-Amr dependency is required. In an existing host, consume host pose/motion snapshots without advancing a second controller, or let a standalone sandbox own its controller explicitly. `assets/runtime-contract.d.ts` describes both modes. Node/TSL materials require a tested compatible renderer; the accepted hybrid uses WebGPURenderer. Standard glTF PBR is another route when tested. Do not promise legacy WebGLRenderer support for a copied WebGPU shader.

## Camera modes

Use three explicit modes unless the host already has an equivalent system:

**Portrait / face study.** Look near the measured eye midpoint with a slight lower target for mouth visibility. Use a relatively narrow field of view and sufficient distance to avoid wide-angle face distortion. Derive framing from head bounds, not a fixed world-space Y. Orbit/zoom limits must keep the camera outside face geometry.

**Follow / locomotion.** A third-person offset follows the body support/root with smoothed vertical motion. The character faces movement, not necessarily the camera. Input direction uses the camera's horizontal heading. Do not recenter immediately after mouse orbit; give user input priority. A modest FOV increase while running is optional and should be disableable.

**Orbit / inspection.** Orbit around full-body bounds and retain user-selected yaw/pitch while moving or standing, as specified. The target should not jump abruptly when switching between portrait and body views.

The source starts in portrait, changes to follow on movement/Space, uses F/V/C, and drag/wheel interaction. Historical FOVs are 31° portrait, 43° orbit and 47–54° follow. These are tuning examples, not fixed anatomy rules. Keep a stable mode-state API independent of UI buttons.

## Collision and comfort

The source raycasts from the target to the desired camera and shortens distance near blockers. A single center ray cannot protect the whole camera near plane at corners. For a stronger host, sweep a small camera volume or use conservative offset rays, keep a near-plane margin and avoid clipping through the character. Test when the target starts near/inside a wall. Check both desired and smoothed positions.

Smooth using time-based response, not fixed-per-frame interpolation. Keep vertical follow controlled during jumps. Do not add mandatory head bob, violent zoom, screen shake or auto-rotation. Respect the user's camera input and optional reduced-motion setting.

## Lighting/materials

The source uses physically based standard materials, ACES filmic output mapping, local room environment lighting, shadows and a bounded device pixel ratio. This is a practical studio-style setup, not a physically complete skin scattering simulation.

New integration must preserve the host's color-management/tone-mapping pipeline. GLTFLoader handles many material conventions; manually added color textures and numeric textures require correct color-space treatment. Use the pinned engine's current docs, not copied deprecated properties. Keep skin detail visible under a neutral key/fill/rim arrangement before artistic lighting.

Do not blindly set all materials with “body” in their name to a skin roughness: clothes and accessories may share those names. Map material roles explicitly and preserve original appearance. Cornea, teeth, wet lip regions, skin and hair should not all receive identical settings. Confirm that intended normal/roughness maps survive export.

## Performance without fake guarantees

Declare a target device/viewport and a frame-time budget. Render statistics, warm/cold loading, memory and animation costs are empirical; measure them. High-DPI rendering, shadow map resolution, texture sizes, mesh count, morph count and skinned vertex count all affect cost, but no single count predicts FPS.

Prioritize face fidelity at portrait distance. Reduce distant body/shadow cost with validated level-of-detail choices when appropriate. Morphs on every accessory can become expensive; measure before removing essential facial deformation. Correct animated bounds or a deliberate culling strategy is preferable to turning frustum culling off forever. The source disables mesh culling as a prototype safety measure.

## Reusable architecture

Suggested modules:

```text
avatar/
  profile                # user brief + resolved asset/adapter parameters
  loader-adapter         # asset decoding, rig/face/material mapping
  runtime                # instance lifecycle and inspection
  locomotion             # collision and movement state
  body-animation         # mixer, retargeting, overlays, foot IK
  face-animation         # presets, bindings, blink/gaze and compositor
  camera-rig             # optional camera controller, host-owned camera
  input-adapter          # optional keyboard/mouse binding
  diagnostics            # local-only inspection and QA output
sandbox/
  world, lights, HUD     # not required by the reusable avatar package
```

Use `assets/runtime-contract.d.ts` as the intended public boundary. It is a type-level specification; the original source is not already a ready-to-import library implementing it. The adapting agent must write the adapter/factory and test the methods.

The host should pass scene, renderer/camera as needed, world-collision queries, asset URLs/base path, input state and delta time. Avoid hard-coded `./assets/avatar.glb` and `document.getElementById` in reusable core modules. A test sandbox may use them.

For two avatars, clone skinned hierarchies correctly (for example using the matching Three.js skeleton-clone utility), create separate mixers/physics/face states, and never share mutable morph influences. Shared textures/immutable geometry may be managed with explicit ownership. Changing one avatar's expression must not change another's face.

## Lifecycle

Load asynchronously with abort/cancel support. If a load finishes after disposal, do not attach the character to the scene. Surface progress and actionable errors without false readiness. A reset clears physics, jump queue, pose, locks, optional face overrides and camera state as documented.

Dispose instance-owned geometries/materials/textures only once; shared assets need reference counting. Stop mixers and uncache roots/actions, remove objects, dispose decoder workers when owned, release bitmap resources where necessary, and unregister keyboard/mouse/visibility/resize handlers. GLTFLoader's docs explicitly warn that image bitmaps need special disposal handling [S4]. Do not dispose the host's renderer or shared scene when disposing one avatar.

## Export and host handoff

Deliver the resolved profile together with actual asset hashes, runtime API and a tiny host example. When transferring an avatar, transfer permitted model/texture/animation assets too, not only control code. If assets cannot legally be redistributed, provide authorized retrieval instructions or replace them; a URL list is not an offline asset bundle.

The test environment is intentionally disposable. A new project's renderer, physics world, multiplayer/networking, voice system and UI are independent integrations. Do not promise networking, VR, ragdolls, cloth or lip sync simply because the current contract leaves room for them.
