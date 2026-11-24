# AVATAR THREE.JS BUILDER — PORTABLE KNOWLEDGE EDITION

Version 1.0.0 · 22 October 2026

This single file consolidates the workflow, technical references and key templates for an agent reading an attachment. It is not a binary avatar, not permanent model training, and not an automatically installed plugin.

Read the **SKILL.md** section first and the **source-audit** section before adapting the example. Other sections can be read on demand. Paths refer to files in the full ZIP; when that folder is unavailable, read the corresponding titled section below. Do not claim that an unprovided source file or executable script has been opened or run.

The full package additionally contains the frozen original source, executable metadata/profile tools, synthetic tests, an agent-evaluation rubric and actual package validation logs. They are not embedded here. The public runtime API below is a design contract that the adapting agent must implement, not an already compiled library.

## Contents

1. Core skill and gated workflow
2. Structural/body contract and appearance separation
3. Asset selection, authoring and export
4. Body animation, controller and foot contact
5. Facial structure and emotion composition
6. Camera, rendering and reusable integration
7. Validation and delivery
8. Original source audit and portability requirements
9. Sources
10. Profile, facial presets, runtime contract and handoff templates



---

# FILE: avatar-threejs-builder/SKILL.md

# Reusable Three.js Avatar Builder

## Mission and boundaries

Produce an executable, inspectable avatar system, not just a concept, screenshot, or list of libraries. Preserve the Avatar Motion Lab pattern: a full-body skinned character, a high-priority expressive face, camera-relative locomotion, Shift to run, Space to jump, six expression states, and a small test scene. Make appearance an interchangeable input, not a hard-coded identity.

This skill transfers a workflow and source example. It is not a trained model, a 3D asset generator, a commercial asset license, or proof of photorealism. Do not claim a new sculpt or captured animation when using an existing asset. Report unavailable tools and untested visual results precisely; continue with independently testable work.

**Two labels govern this package:** `SOURCE FACT` describes code actually present in `assets/reference-project/`; `PORTABILITY REQUIREMENT` describes the generalized design to implement in a new project. The snapshot has not already been refactored into the new API/profile described here. Read `references/07-source-audit.md` before copying it.

## Load the minimum useful context

Always read this file, the user's brief, and `references/07-source-audit.md`. Then read:

| Task | Additional reference |
|---|---|
| New avatar, body structure, component contract | `references/01-contract-and-anatomy.md` |
| Choose/create/replace/export a character | `references/02-assets-and-authoring.md` |
| Idle, walk, run, jump, retargeting, foot contact | `references/03-body-animation.md` |
| Emotions, blink, gaze, facial rig | `references/04-face-animation.md` |
| Camera, rendering, host application integration | `references/05-camera-rendering-integration.md` |
| Testing, packaging, release decisions | `references/06-validation-and-delivery.md` |
| External facts, engine/platform documentation | `references/SOURCES.md` |

Use templates in `assets/`. Read the original source only for the subsystem being adapted. Do not load the entire source snapshot into context without a reason. In a single-file chat, use the corresponding titled sections of `AVATAR-SKILL-PORTABLE.md`.

## Non-negotiable rules

1. **Appearance is data.** Age appearance, presentation, proportions, skin, face, hair, facial hair, eyes, clothes and visual style come from the brief/profile. Do not carry the sample's male identity, 1.78 m height, clothing or skin into another project. Unspecified identity stays unspecified or is explicitly chosen as a temporary placeholder. Appearance fields do not magically remodel a GLB; author/select a compatible asset.
2. **Preserve working inputs.** Inspect user-provided GLB, skeleton, textures, clips and licenses before replacing anything. A useful existing rig should not be rebuilt just to match example bone names.
3. **Capability before marketing.** High polygon count is not a facial rig. Bone count is not correct retargeting. A UI with emotion buttons is not a visibly expressive character. A generic generated mesh is not a ready-to-animate human.
4. **One owner per transform/channel.** The controller owns world position and yaw. The body animator owns the base pose. Additive layers own explicit pose offsets. The face controller owns only explicitly mapped expression channels. Do not reset identity/body-size morphs, cloth correctives or another system's lip-sync.
5. **Measure rather than assume.** Resolve rig semantics, bind-pose axes, model forward, ground offset and facial channels from the asset. Fail on ambiguous mappings; do not silently overwrite duplicate names.
6. **Keep sources honest.** Asset, texture, motion, code and decoder licenses are separate. Record source/version/hash and rights status. Do not auto-use the reference AvatarSDK asset for a commercial request. Unknown permissions block commercial release, not unrelated local code work.
7. **Do not inherit test claims.** Unit, server, UI-shell, WebGL, facial visual, motion visual and performance tests are distinct. “Not run” is not “pass.” Historical source tests do not verify the current model.
8. **Retain user control.** Do not upload a face photo, buy a model, create an account, publish a project, or change remote repositories without the necessary user authorization. Use available tools; never invent a completed model-generation/export job.

## Input and output contract

Start from `assets/avatar-profile.template.json`. Separate:
- `appearance`: a human-readable art brief; it is not proof an asset has these features;
- `assets`: selected local model/motion paths and known provenance;
- `normalization` and `rig`: coordinate conventions and an explicit semantic bone map;
- `face`: expressive channel bindings, channel ownership and optional unsupported features;
- `movement`, `camera`, `quality`, `deployment`: tunable behavior, not identity.

`null` means unresolved. Resolve required fields before release, not by filling fake URLs, licenses, performance values or SHA hashes. Basic draft checking:

```sh
python scripts/validate_profile.py assets/avatar-profile.template.json
python scripts/inspect_glb.py /path/to/avatar.glb --profile /path/to/avatar-profile.json --out /path/to/asset-audit.json
```

Run these relative to the skill directory. The GLB inspector reads metadata only and does not establish deformation correctness, texture sharpness, skin-weight quality, expression meaning or complete glTF conformance.

Deliver: runnable source; profile; required local assets or a clearly labeled first-run installer; asset/provenance manifest; rig/face mappings; tests and their evidence; usage/controls; limitations; and a reusable runtime interface. Do not deliver only a written plan when the user requested a build and tools permit implementation.

## Execution workflow and gates

### A. Read and inventory

Read the host project's conventions first. Identify engine/version, existing scene/render loop, devices, offline/commercial requirements and actual tools. Record unanswered nonblocking preferences as assumptions; avoid repeatedly asking for known information. For appearance, accept a textual brief or an authorized reference. A photo is optional unless likeness is requested; do not infer character identity from the user.

Run the metadata audit on each candidate asset. Inventory skins, joint hierarchy, mesh parts, materials, textures, morph names, animation names, compression extensions and dependencies. Produce `asset-audit.json` and a capability table with `supported`, `unsupported`, `ambiguous` or `not-tested`.

**Gate A:** Full body and deformable skeleton exist, or an explicit asset-authoring task is underway. The selected facial workflow has usable channels or a concrete authoring route. Do not proceed as though a static face already supports emotions.

### B. Select the asset path

Prefer a compatible licensed user asset. Otherwise select a licensed rigged asset meeting the brief. Only create a new model when authoring tools and assets are available; follow the authoring reference for topology, skinning, facial shapes, materials and export. An image-generation result is a visual reference, not the required 3D deliverable. If facial shapes are absent, author them, use an actual supported facial-bone adapter, or explicitly deliver body-only as incomplete against a face requirement.

**Gate B:** Record licenses separately and confirm assets are retrievable. Do not hard-code the original sample URL in a general-purpose factory.

### C. Normalize and adapt the rig

Load glTF with compatible local decoder dependencies. Establish application coordinates: meters, Y-up, XZ ground, canonical character forward +Z, root at the support plane. This is the app contract, not a claim that every imported model faces +Z.

Use a wrapper transform to normalize scale/forward/offset while preserving skin bind matrices and authored proportions. Derive standing height and foot/camera offsets from measured landmarks; hair/props must not determine body height. Preserve reliable source units when no height override is requested. Resolve canonical bone roles to exact source identifiers. Capture a clean reference pose and test small isolated rotations before retargeting.

**Gate C:** Upright full body, correct direction, neutral stance, intact skinning and working bilateral limbs. A count of 15 matched bones alone never passes this gate.

### D. Build movement before polish

Implement camera-relative normalized input, actual-velocity-facing rotation, acceleration/braking, collision, ground support and fixed-step simulation. Preserve WASD/arrows, Shift, Space, focus-loss cleanup and no double jump. Support optional jump buffering/coyote time, with one takeoff per accepted press.

Retarget or use compatible idle/walk/run clips. Preserve target segment lengths. Correct reference-pose and axis differences; explicitly choose in-place versus root-motion ownership. Blend idle/walk/run with actual achieved velocity, not held keys. Synchronize foot phases and tune playback rate to ground speed. Add anticipation/rise/fall/landing, breathing and restrained turning lean. Prototype procedural jump is permitted, but must be labeled procedural. Foot IK is a refinement, not a repair for a broken rig.

**Gate D:** Normal speed, sprint, stop, turn, wall contact and grounded jump work with valid finite transforms. Verify visual motion separately.

### E. Build the face as a layered system

Use `assets/facial-presets.json` as an initial artistic calibration, not universal anatomical truth. Implement `neutral`, `smile`, `laugh`, `sad`, `angry`, `surprise`; default to a gentle smile. Keys 0–5 and UI controls must agree.

Bind canonical expression channels to existing per-mesh morph indices, or an explicitly implemented equivalent facial-bone route. Use per-avatar gains, limits and correctives. Compose mood, intensity, manual overrides, blink, gaze and subtle micro-motion. Resolve opposing channels and jaw ownership. Reset only channels this system owns. Preserve identity morphs. Disabled features must visibly report missing support.

**Gate E:** In a real face close-up, expressions are distinguishable, return to neutral cleanly and do not tear lips/eyelids or detach teeth. Numerical weight tests alone cannot pass this gate.

### F. Add camera and rendering

Use face-study/portrait, third-person follow and full-body orbit. Derive framing from actual eye/head/body bounds. Movement exits portrait mode. Use smooth orbit/follow and conservative FOV changes; respect manual camera input before recentering. Prevent wall intersection using a camera-volume or conservative multi-ray check in production, not just a center ray.

Use sensible PBR materials, face-prioritized texture detail, light that reveals shape, bounded pixel ratio and local dependencies. Do not change skin color or material roughness globally by arbitrary mesh-name heuristics. Do not promise film-quality subsurface skin from basic PBR.

### G. Integrate for reuse

Implement/adapt `assets/runtime-contract.d.ts`; it is a design contract, not a compiled library. Isolate the avatar from DOM, input bindings, test world, camera and global render loop. The host owns renderer/scene/time unless explicitly delegated. Multiple avatars must have independent skeletons, mixers, state and expression influences. Keep shared textures reference-counted. Provide load, update, set-expression, reset, inspect and dispose paths.

Do not start a second RAF loop inside an existing host. Do not write a production singleton to `window`. Keep optional debug APIs namespaced. Remove all event listeners, observers and owned GPU resources on disposal.

### H. Validate, package, hand off

Use `references/06-validation-and-delivery.md`. Run deterministic tests, actual GLB load, a browser runtime check, six face views, a motion/camera recording, two-avatar independence and spawn/dispose tests. Test cold install and offline reload independently. Record exact commands, asset hashes, browser, hardware, resolution and measured results.

Use `assets/TEST-REPORT.template.md`. Gate each claim with evidence. If rendering is blocked, deliver the functional source and failing/pending gates; do not rename an unverified prototype “production-ready.” Final response should link artifacts, give simple launch instructions and state material limitations without burying them.

## Completion and resume protocol

Store progress in `assets/handoff-state.template.json` copied into the working project. Record actual artifact paths, finished/pending gates, decisions, unresolved licenses and the next verifiable action. The next agent must inspect files and rerun relevant checks, not trust a previous summary as execution evidence.

**Done means:** the requested reusable avatar behavior is implemented; appearance is replaceable through asset/profile/adapters; assets and rights are documented; intended runtime tests are reported truthfully; another developer can launch it from the delivered instructions. A text-only agent can provide implementation instructions but must not claim to have produced or tested binary geometry it cannot create or inspect.


---

# FILE: avatar-threejs-builder/references/01-contract-and-anatomy.md

# 01 — Structural contract and anatomy

## Status

This is the generalized design to implement. The original runtime has `actor`, `physics`, `director`, `cameraRig` and `emotions`; it does not yet expose the unified interface or consume the new profile. See the source audit for exact differences.

## Three independent layers

**Identity / appearance** describes the selected person or fictional character: approximate age appearance, presentation, stature, proportions, complexion, facial structure, eye/hair appearance, clothing and style. It is a brief and asset choice. A profile value such as `hair.description` does not procedurally grow a hair mesh unless a separate authoring/customization implementation exists.

**Asset adapter** maps the chosen mesh, skeleton, facial controls, materials and clips to semantic roles. It contains exact bone identifiers, normalized forward axis, reference-pose corrections, face channel mappings, foot/eye anchors and calibration values. Different assets need different adapters even when the public behavior is identical.

**Runtime behavior** applies input, collision, body animation, emotion blending and camera interaction. It should not know whether the character has a beard, a skirt, a particular ethnicity, or a particular sex. Clothing may require a collision/deformation adjustment, but not a different movement architecture.

## Body components

A full-body avatar normally has a deformable body surface, head/face, eyes and eyelids, mouth interior with teeth (and tongue when visible), hair/brows/lashes, clothes and footwear. These are semantic parts; they may be separate meshes, submeshes, materials or merged geometry. Do not require a particular mesh count.

The highest facial detail should go to eyelid/lip deformation, eyeball placement, brow silhouette, mouth interior and normal/roughness information visible at the intended close-up distance. More vertices alone do not fix an incorrect mouth or rigid eyelids.

Support each visible accessory correctly: glasses/hats follow the head; a watch follows the forearm/hand region; teeth follow the appropriate jaw or equivalent morph; skin-tight clothing uses compatible skinning. Rigid attachments are not cloth simulation. Hair cards, hair meshes and strand approaches have different runtime costs; do not imply physical strands when the asset contains textured cards.

## Canonical semantic skeleton

Use the following names at the adapter boundary; imported names can differ. Additional twist, helper, finger, jaw, eye or cloth bones are allowed.

```text
avatarRoot (world movement; not a replacement for the pelvis)
  modelOffset (unit / forward / sole normalization)
    skeletonRoot
      hips
        spine ... chest ... neck ... head
                              |       leftEye / rightEye / jaw (optional)
                   leftShoulder ... leftUpperArm -> leftLowerArm -> leftHand
                   rightShoulder .. rightUpperArm -> rightLowerArm -> rightHand
        leftUpperLeg -> leftLowerLeg -> leftFoot -> leftToes (optional)
        rightUpperLeg -> rightLowerLeg -> rightFoot -> rightToes (optional)
```

This is semantic ancestry, not mandatory direct parenthood. Arms are usually descendants of an upper torso node; the sketch does not require every bone to be directly parented to `chest`. Optional twist bones may appear between semantic endpoints.

For the full-body scope, require unique pelvis, at least one spine, head, both upper/lower arms and hands, and both upper/lower legs and feet. Prefer neck, chest, shoulder and toe roles. Map missing optional roles explicitly or disable their overlays. A missing required role is a capability failure unless a deliberately different body contract has been agreed.

Finger segments improve hand posing but are not a substitute for the required arm/leg chain. Face can be controlled by morph targets, bones or a hybrid; the **reference implementation uses named morph targets**. A bone-only face needs a separately implemented and tested adapter.

## Safe normalization

1. Record source units, node transforms, bind matrices and unposed landmarks before modifying anything.
2. Verify model forward visually or from an explicit authoring convention. File format alone is not an orientation detector.
3. Normalize through an outer group. Retain authored segment lengths, inverse bind matrices, skin indices and weights.
4. Measure standing height from a neutral pose using body/foot/head landmarks. Do not use total bounds containing a raised hand, long hair or a weapon as standing height.
5. Apply height override only when requested; otherwise preserve trustworthy meter units. If units are unknown, record and calibrate a provisional unit scale.
6. Recompute sole clearance, collider height/radius, head/eye anchors and camera distances from the normalized body. Test short/tall and broad/slender profiles.
7. Avoid negative/nonuniform scale within a skinned hierarchy unless explicitly supported and verified.

## Animation ownership

| Owner | Writes | Must preserve |
|---|---|---|
| Character controller | World root position, yaw; collision state | Skeleton anatomy and facial weights |
| Animation mixer | Base local bone pose | Root motion policy and identity morphs |
| Additive body layer | Explicit spine/head/limb offsets | Fresh base pose every frame |
| Foot IK | Leg chain corrections and approved pelvis correction | Bone lengths; airborne pose |
| Face composer | Mapped expression channels only | Identity, corrective and external speech channels not assigned to it |
| Camera rig | Camera transform/projection | Character transform |
| Host app | Scene, renderer, lifecycle, global time | Per-avatar independence |

Never accumulate procedural offsets on last frame's already-offset pose. Evaluate a fresh base pose, then apply overlays once. Otherwise an arm may drift or rotate continuously after many updates.

## Profile semantics

The JSON template is intentionally incomplete where the source model is unknown. Set an asset path, inspect it, resolve the adapter and freeze the resolved profile with the asset hash. `targetHeightMeters: null` means preserve/calibrate rather than force the old sample's height. `maxDownloadBytes: null` means no user-specified cap, not an unlimited memory budget. `commercialUse: null` means deployment intent still unresolved; do not infer clearance.

Shape names are not universally standardized. Keep canonical expression names stable but allow per-mesh index/name bindings with scale, offset and range. If two source bones normalize to the same alias, require an explicit identifier rather than “last one wins.” Stable node indices may be used for a pinned GLB; regenerate them when the asset changes.

## Scope limits

The common contract targets ordinary bipedal humanoids. Quadrupeds, crawling-only rigs, extra limbs, mobility aids or deliberately non-human proportions need explicit locomotion/physics adapters and new tests. They are not guaranteed compatible just because they are “avatars.” Do not force one movement style on a user who requests another.

## Sources

The binding/skin/morph distinctions are supported by the glTF specification and Three.js `SkinnedMesh`/`Mesh` docs [S1–S3]. The component layout and adapter contract above are this package's engineering design, not a mandatory glTF hierarchy.


---

# FILE: avatar-threejs-builder/references/02-assets-and-authoring.md

# 02 — Asset selection, creation, and export

## What was actually done before

The reference project loads an existing full-body AvatarSDK example from TalkingHead. Its face, body mesh, skinning and textures were not sculpted in that project. Idle/walk/run were extracted from the Three.js Xbot example and adapted in code. The application adds procedural movement, facial weights, camera, test world and UI.

Reproducing this method therefore means **inspect → select/adapt → control → validate**, not pretending that JavaScript generated a photorealistic human from primitives. Creating a new custom body or likeness is an additional authoring step.

## Route selection

| Available input | Correct route |
|---|---|
| Licensed full-body GLB, usable rig and face shapes | Preserve it; build the adapter and calibrate |
| Rigged body with idle/walk/run but no face shapes | Keep body/animation; author facial shapes or obtain a permitted compatible face rig |
| Static model with suitable human topology | Rig, skin and author expressions in a capable DCC tool before runtime integration |
| Only a photo or descriptive brief | Create/select a 3D asset; treat any image output as reference, not completed geometry |
| Ready model but ambiguous/missing rights | Continue technical audit; block commercial release until resolved |
| No 3D authoring tools | Implement reusable runtime and validation; identify the missing model/rig work explicitly |

Use Blender or another available digital-content-creation tool only when it is actually installed or accessible. Do not invent exports, available plugins, current vendor plans, asset-generation capabilities or service responses. Verify current external services and terms before relying on them.

## DCC authoring checklist (new work, not historical evidence)

**Base body.** Establish a neutral A/T reference pose, consistent scale, a continuous intended silhouette and plausible joint locations. Keep facial appearance in an art brief. Test the actual user proportions rather than forcing the prototype's proportions.

**Deformation topology.** Place edge flow around eyelids and lips so they can close without gaps; provide sufficient deformation support around shoulders, elbows, hips and knees. The exact topology is an artistic/rigging decision. Store a clean neutral face. Do not reorder vertices after authoring shape-key deltas unless they are regenerated consistently.

**Skinning.** Bind a humanoid skeleton and assign vertex influences. Test extreme joint poses, twisting and shoulder lift. Inspect normalized weight sums, valid joint indices, inverse bind matrices and unintended disconnected vertices with appropriate authoring tools. A metadata audit does not test these numeric values.

**Face.** Create independent bilateral shapes where the geometry supports them: smile/frown, brow lowering, brow raising, blink, widening, squint, cheek movement, jaw opening, lip shaping and optional nose sneer. Keep a true neutral separate from the default gentle smile. Do not copy a target name onto identical geometry and count it as a new expression.

**Eyes and mouth.** Place eyeballs so lids follow the surface; close blinks fully without swallowing the eyeball. Assign upper/lower teeth and tongue correctly. Decide whether jaw opening is a morph, a bone rotation or a coordinated hybrid and prevent it from being applied twice.

**Materials.** Use an appropriate skin color texture, roughness and normal detail; keep color data separate from linear parameter data. Preserve identity across light changes. Hair/eyelash transparency needs explicit sorting/alpha choices and tests. Face texture sharpness must be evaluated at final portrait framing, not the texture file dimensions alone.

**Animations.** Prefer clips authored for the rig when available. Otherwise retain the target skeleton and adapt licensed source clips. Capture/export a reliable reference pose. Keep looping locomotion separate from nonlooping takeoff/landing.

**Export.** Export binary glTF 2.0 with skins, vertex weights, facial targets and required animations intact. Reimport the exported file independently and compare the reference pose, one bent limb, a blink, open jaw and smile. Export support and UI vary by DCC version; verify the tool's current official instructions. glTF can carry skins and morph targets [S1]; do not assume every exporter option preserves them automatically.

## Runtime audit

Run the provided `inspect_glb.py`; use the official glTF Validator and an actual Three.js render for stronger validation. The bundled tool reports metadata, selected semantic mappings, referenced files, morph availability and decoder requirements. It does not download, render, decode textures or rewrite a GLB.

A strict metadata failure is not always a broken asset. For example, a bone-only facial rig can be valid but is unsupported by the named-morph inspector; unnamed morph indices require an explicit runtime adapter. Label the distinction clearly.

## Provenance and rights

Fill the manifest per asset: local path, source URI, version/commit, SHA-256, byte count, author, stated license/terms reference, intended use and review status. Hash actual bytes; never make up a hash. License status is recorded by a human/agent review, not established by a checksum or this script.

The original AvatarSDK sample is described upstream as non-commercial. Its code-hosting repository's license does not grant blanket commercial rights to all sample models. The Xbot motion is also third-party source material; extracting only tracks does not erase its rights. Preserve the original notices under `assets/reference-project/THIRD_PARTY_NOTICES.md`; replace restricted assets when the use requires it.

Do not embed personal photos in a distributable skill, upload them to an external authoring provider without authorization, or commit a user's private likeness to a public repository automatically.

## Reproducible installation

Pin engine/addon/decoder versions together. Include local texture and decoder files needed by the selected asset; a GLB may still refer to external resources. GLTFLoader requires the relevant decoder/texture loader for supported compressed assets [S4]. The reference r180 pin is a reproduction detail, not a claim that it is today's latest or mandatory for every host.

Prefer local project assets. If downloads are necessary, use approved HTTPS sources, hashes where available, limits, atomic writes, retry/error messages and resumable cache behavior. Keep TLS verification enabled. Validate cached files too. Do not execute arbitrary downloaded scripts. Only describe the bundle as fully offline after an offline run with no unapproved external requests succeeds.


---

# FILE: avatar-threejs-builder/references/03-body-animation.md

# 03 — Body animation, controller and foot contact

## Baseline and tuning

The source prototype uses a renderer-independent `CharacterPhysics`, a Three.js `MotionDirector`, and an outer avatar group. Simulation is stepped at 1/120 s; rendering is separate. This is an example implementation, not a general rigid-body engine.

Historical tuning values are: walking 1.52 m/s, running 4.25 m/s, acceleration 8.5 m/s², braking 12.5 m/s², gravity 18.8 m/s², takeoff speed 5.6 m/s, anticipation 0.095 s, landing overlay 0.25 s, coyote time 0.10 s and jump buffer 0.18 s. Gravity is gameplay tuning, not an assertion of terrestrial gravity. Preserve these only for reproduction; expose them in a new runtime profile and recalibrate stride/body scale.

Approximate ballistic diagnostics ignoring anticipation, collision and integration error:

```text
height = takeoffSpeed² / (2 * gravity)
time_up = takeoffSpeed / gravity
```

The historical values imply about 0.83 m of root rise. Do not advertise this as measured visual head/foot height.

## Frame order

1. Read focus-safe input and a stable camera-yaw reference.
2. Advance fixed-step controller with bounded accumulated time and a maximum catch-up count.
3. Set avatar root world position/yaw; optionally interpolate between physics states for rendering.
4. Evaluate the fresh base skeleton pose from clips.
5. Apply breathing/turn/jump/landing overlays once, then update world matrices.
6. Solve feet only when supported/grounded; release stale locks in the air.
7. Apply constrained head/eye targeting using a stable target; avoid an oscillating head-camera feedback loop.
8. Compose owned facial weights, update anchors, update camera, render.

Slow motion scales simulation and animation consistently; input/camera responsiveness may use real time. On tab hide/focus loss, clear keys, cancel drag and reset accumulated time. Do not claim frame-rate independence while silently dropping large elapsed time; disclose catch-up limits and test 30/60/120 Hz.

## Controller invariants

Normalize diagonal input; apply movement in the camera's horizontal plane; face the **achieved velocity** rather than teleporting rotation or walking backward unintentionally. Shift changes desired speed only while movement exists. Clamp angular change smoothly across ±π. Move and collide before measuring animation speed: pushing into a wall must not play a full-speed sprint in place.

State transitions:

```text
idle <-> walk <-> run
supported + buffered jump -> anticipation -> rising -> falling -> landing
walking off a ledge -> falling
landing -> idle/walk/run according to actual speed
```

Use an edge-triggered jump request with a short queue; holding Space must not auto-repeat jumps unless that is an explicitly requested feature. Coyote/buffer times do not authorize a second takeoff in the air. Anticipation state must not repeatedly reset itself. A ceiling hit must stop upward motion in environments with overhead geometry.

The reference collision system uses horizontal circles against axis-aligned boxes, top surfaces and a square boundary. It is **not** a full capsule sweep or a generic terrain solver. For slopes, moving platforms, ceilings or fast motion, use an adequate physics/controller implementation with sweep/support-normal handling and new tests; do not extrapolate the box-demo tests.

## Retargeting recipe

Prefer direct playback when the clip is genuinely authored for the target rig. For different rigs:

1. Resolve unique semantic bone correspondences and semantic ancestor chains, including helper/twist bones.
2. Capture both reference poses and world-space axes. A/T differences and bone roll matter; identical names do not imply compatible local rotations.
3. Compute per-role orientation corrections from an anatomical frame with two axes, not one direction vector alone. Test shoulders, elbows, wrists, hips, knees and ankles separately.
4. Sample the source clip; convert desired world rotation into target parent-local rotation. In the source's convention the structure is `qLocal = inverse(qParentWorld) * qSourceWorld * qCorrection`. Quaternion multiplication order and the definition of `qCorrection` are convention-dependent; verify the resulting reference pose instead of copying this formula blindly.
5. Preserve target local segment translations and skin bind data. Scale permitted pelvis translation using body/leg measurements, not raw source units.
6. Choose in-place playback for a controller-owned root. Remove source horizontal drift and heading from the retained root channel while keeping calibrated vertical pelvis motion. Never apply translation from both a motion clip and the controller.
7. Bake stable tracks or apply runtime retargeting. Assert finite normalized rotations and unchanged segment lengths. Verify interpolation types; do not silently convert CUBICSPLINE to linear samples without actually evaluating it.
8. Loop only cyclic motions. Blend loop seams where appropriate. Forcing the last frame to equal the first is not valid for a jump or landing clip.

The source performs custom world-space baking at approximately 40 samples/s. It does not call `SkeletonUtils.retargetClip`. Using that Three.js utility is an alternative; check the pinned version's required skeleton/object shape [S5]. Retargeting success is a visual/pose gate, not the number of bones found.

## Locomotion blending

Use overlapping speed regions for idle/walk/run and normalize weights. Mixers/actions support weighted playback and cross-fades [S6–S7]. When synchronizing gait, use consistent left/right foot-contact phases and verify which foot is planted at each phase. A useful starting relation is:

```text
cycles_per_second = achieved_speed / (calibrated_ground_speed * clip_duration)
```

This preserves a cycle/second dimension. Avoid advancing a clip twice by both assigning `action.time` and also using a normal `mixer.update(dt)` that advances it again. The source explicitly sets times then calls `mixer.update(0)`.

Keep stopping/starting natural by reducing strides as speed changes. Foot sliding has multiple causes: wrong root-motion ownership, wrong gait speed, poor phase alignment, retarget axes and contact timing. Tune these before adding strong IK locks.

## Procedural overlays

Breathing is subtle chest/head motion, not oscillation of the entire world root. Turning lean should depend on angular velocity and speed, with small limits. Preserve the base pose of every bone you offset, even when its clip has no track. Jump pose should track takeoff, vertical velocity and landing impact. A simple procedural crouch/tuck can be a valid prototype, but it is not captured human motion.

## Foot IK

Use two-bone inverse kinematics (IK: solving joint angles so a foot reaches a target). Derive thigh/shin lengths from the current target rig. Query the actual support surface under each foot, not only under the pelvis. Lock a foot only during a plausible stance phase. Unlock for swing, takeoff, teleport, reset, excessive reach or changing platform support.

Clamp hip-to-ankle distance to `[abs(thighLength-shinLength)+epsilon, thighLength+shinLength-epsilon]`. Keep a stable knee bend direction and a valid fallback when vectors are near zero. Do not stretch the leg, hyperextend knees or solve with NaNs. On sloped ground, align sole orientation to the support normal only when that feature exists. The reference does not implement a full slope-aware sole solver.

Blend IK strength and, where needed, a small pelvis offset. A foot lock is not universal: the source's height-based heuristic can misclassify stance and needs per-clip visual verification.

## Required evidence

Record idle, eight-direction movement, acceleration, start/stop, walk/run changes, sharp turns, wall pushes, step traversal, stationary/moving jumps and loss of support. Review at normal speed and slow motion. Measure foot displacement during stance and penetration depth against project tolerances; do not fabricate a “zero foot sliding” claim. Capture with IK on and off to isolate causes.


---

# FILE: avatar-threejs-builder/references/04-face-animation.md

# 04 — Facial structure, emotions and composition

## Meaning of a facial channel

The reference uses existing named morph targets: each is a stored shape deformation and is driven by a weight. Three.js exposes their dictionary and influences on a mesh [S3]. A similarly named target can have very different amplitude across assets. Treat the canonical names here as semantic controls, not guaranteed vendor compatibility or proof of ARKit certification.

The delivered `facial-presets.json` reproduces the original six preset weight dictionaries. They are artistic starting values, not a scientifically validated mapping between inner human emotion and muscle activity. The face must be calibrated visually for each selected avatar.

## Expression targets

| State / key | Intended visible result | Principal controls |
|---|---|---|
| neutral / 0 | Relaxed face; no forced smile | Expression-owned weights return to their baselines |
| smile / 1 | Mild lifted lip corners; slight cheek/eye involvement | `mouthSmileLeft/Right`, `cheekSquintLeft/Right`, `eyeSquintLeft/Right` |
| laugh / 2 | Strong smile, cheeks lifted, mouth opening varies | Smile, cheek/eye squint, upper/lower lip, `jawOpen` |
| sad / 3 | Raised inner brows and lowered mouth corners | `browInnerUp`, `browDownLeft/Right`, `mouthFrownLeft/Right`, subtle lip press |
| angry / 4 | Lowered brows, restrained eyelid/lip tension | Brow down, eye squint, nose sneer, lip press, small jaw controls |
| surprise / 5 | Raised brows, widened eyes, opened jaw | Inner/outer brow up, eye wide, jaw open, optional funnel |

Neutral is not the default gentle-smile state. Both must be independently selectable. Laughing jaw movement does not imply an audio track, speech synthesis or lip sync.

## Channel coverage

Essential morph-mode controls for the requested face include bilateral blink, smile, frown, brow down, outer brow up and eye wide, plus inner brow up and jaw open. Check **both sides**; the source's compact warning list is not enough. Cheek squint, eye squint, nose sneer, lip shaping and detailed jaw controls improve the presets. Gaze may use eye bones or eye-look morphs, but not two uncompensated methods simultaneously.

There is no required magic total such as exactly 52 shapes. An avatar with fewer meaningful controls can support the requested expressions; an avatar with hundreds of unrelated/empty shapes may not. Report per-expression coverage, not just total morph count. Absent optional channels should reduce/degrade the associated feature visibly and be logged. Missing core channels block a claim of fully supported expressions.

## Adapter binding

Bind `(canonicalChannel -> one or more mesh/target pairs)`. Resolve each pair by exact per-mesh target name or a confirmed target index. A single channel may drive head, beard or eyelash geometry together. Normalize names only for discovery; detect ambiguity and freeze exact bindings for production. Do not guess that `Smile`, `Happy`, and `mouthSmileLeft` are geometrically equivalent.

Recommended binding fields:

```json
{
  "canonical": "mouthSmileLeft",
  "bindings": [
    {"mesh": "REPLACE_WITH_ACTUAL_HEAD_MESH", "target": "REPLACE_WITH_ACTUAL_TARGET", "gain": 1.0, "offset": 0.0, "min": 0.0, "max": 1.0}
  ]
}
```

The placeholder is documentation, not a real asset binding. Select immutable identifiers or asset-hash-pinned node indices when names are duplicated. Preserve a baseline for all non-owned morphs. Never zero every morph on a mesh to reset a smile: that can erase body size, identity, corrective and speech shapes.

## Layer composition order

Use one explicit compositor and document ownership:

1. Start from the avatar's expression-neutral baseline; leave non-owned channels untouched.
2. Evaluate emotion target weights multiplied by user intensity.
3. Apply bounded micro-motion, only where relevant. Keep a seeded random stream for reproducible QA.
4. Apply user manual overrides to their channels; changing presets clears them unless the UI explicitly offers persistent overrides.
5. Add or override speech/jaw channels only when a speech subsystem is actually present; declare priority and limits. Do not introduce fake speech capability.
6. Resolve mutually exclusive controls: e.g. smile/frown overdrive, press/jaw-open conflict, squint/wide conflict.
7. Smooth mood transitions with `alpha = 1 - exp(-response * dt)`; clamp finite weights to calibrated ranges. Facial ranges may differ by asset; source presets use [0,1].
8. Apply blink closure **after** the slowly smoothed mood and enforce a final eyelid constraint. A blink must not be opposed by a stale smoothed eye-wide value. Reopen toward the current mood rather than a fixed wide-eye state.
9. Apply constrained gaze using a single selected eye-driving method and calibrated left/right signs.
10. Write only owned bound targets once and update any actual corrective shapes.

The original implementation suppresses the desired eye-wide value before smoothing and writes blink directly. That numerical arrangement does not prove eyelid closure on a real face; the generalized compositor must check the final combined values/geometry.

## Blink and gaze calibration

Historical blink timing is about 70 ms closing, 33 ms closed, 137 ms opening, then a mostly 2.4–5.5 s wait with occasional double blinks. These are reproducible stylistic parameters, not biological invariants. Disable or slow optional motion for accessibility/user preference.

Targets should be limited in the head-local eye frame and agree across eyes. Confirm “look left/right” visually from both front and side; left/right labels vary with authoring convention. Limit eye deviation and head follow; do not create cross-eyed fixation. A body turning away should not rotate eyes through the back of the head. Avoid a camera-follow/head-look feedback loop that makes the face wobble.

## Geometry and rendering failure checks

A wide mouth must reveal an appropriate interior, not an empty head or floating teeth. Lips should not invert or pass through one another. Eyelids must close over the eyeball; brows/lashes must track the intended facial deformation. Beards/hair near the mouth may need corresponding shapes or carefully bound skinning. Test shadows and transparency around lashes, nostrils, mouth and cornea.

Face calibration is not complete from front-only thumbnails. Capture front, 3/4 and profile neutral/smile, and front close-ups for all six emotions. Toggle micro-motion to distinguish expression shape from incidental motion. Check transition sequences such as laugh → sad → neutral and surprise + blink.

## Useful debugging

Expose raw canonical values, resolved per-mesh binding count, missing/ambiguous channels, current baseline, emotion intensity and final applied values. Keep a “neutral/reset owned face” command separate from “reset entire character.” Label unsupported sliders as unsupported instead of showing a responsive slider that does nothing.

Expression intensity must remain independent of skin tone, sex/presentation and age descriptors. Any artistic calibration must be based on the actual mesh, not stereotyped assumptions about those attributes.


---

# FILE: avatar-threejs-builder/references/05-camera-rendering-integration.md

# 05 — Camera, rendering and integration

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


---

# FILE: avatar-threejs-builder/references/06-validation-and-delivery.md

# 06 — Validation, failure recovery and delivery

## Separate evidence categories

| Category | What a pass means | What it does not mean |
|---|---|---|
| Profile/schema | Config has the checked structure and coherent numeric settings | The selected asset exists or looks correct |
| Metadata audit | GLB header/JSON and reported metadata checks completed | Full glTF conformance, skin weights, decoded textures or visual quality |
| Unit tests | Tested controller/maths/composition behaviors pass | Browser interaction or realistic human motion |
| HTTP/server | Routes, MIME, errors and local access work | WebGL model loaded |
| UI shell | DOM/layout/event states tested in stated conditions | Rig/emotions/camera rendered correctly |
| Real runtime | Actual chosen GLB decodes and updates without observed exceptions | Production realism at every pose |
| Face review | Recorded expressions/closure/transitions meet stated criteria | Universal correctness for another identity |
| Motion review | Recorded gait/jump/contacts meet stated criteria | Every terrain/physics case is solved |
| Performance | Measured timing/memory on named setup | Same FPS on all hardware |
| Licensing review | Identified review status with terms/evidence | An automated legal guarantee |

Use pass / fail / blocked / not-run / not-applicable. Include exact asset hash and runtime revision. “Blocked” must name the actual blocker. Never copy a previous report's pass onto a changed asset.

## Deterministic tests

Cover diagonal normalization; camera-relative motion; shortest-angle interpolation; acceleration/braking; Shift; Space edge handling; single takeoff and buffered landing; wall/step behavior; finite states; reset and focus loss; fixed-step timing at 30/60/120 Hz; face weight ranges; neutral restoration; manual overrides; deterministic seeded micro-motion; blink conflict; optional channel degradation; identity morph preservation; duplicate bone names; independent instances; and lifecycle cancellation/disposal.

Store raw results and test code. The skill's own scripts can be tested with:

```sh
python -m unittest discover -s tests -v
```

The frozen source project has its own Node suite:

```sh
cd assets/reference-project
node --test
```

Neither command launches a real 3D render or tests the full generalized runtime contract.

## Manual/browser acceptance matrix

Capture actual screenshots/recordings, not generated illustrations of the intended result. Use one constant asset/lighting configuration when comparing expressions.

- **Asset:** Correct stature/forward/ground offset; neutral pose; independent left/right limbs; eyes, teeth and clothing attached correctly; no missing texture or unsupported-extension errors.
- **Face:** Keys/UI 0–5; intensity 0/0.5/1; front close-up of six states; 3/4/profile neutral and smile; surprise plus full blink; laugh → sad → neutral; valid teeth/jaw motion; no identity morph reset; optional feature labels.
- **Body:** Standing, 8-direction walk/run, acceleration, braking, 180° turn, pressing into walls, steps, stationary/moving jump, falling off support, landing, reset while airborne, IK on/off and repeated cycles without drift.
- **Camera/input:** F/V/C, drag/wheel, corners, wall proximity, start/stop near a wall, portrait-to-follow, keyboard focus in forms, focus loss while holding W/Shift, Escape/cancel interactions as implemented.
- **Reuse:** Two differently proportioned assets using the same runtime; two independent instances; create/remove/recreate loop; no duplicate listeners or second RAF; host survives avatar disposal.
- **Distribution:** Fresh directory launch; missing/corrupt asset message; interrupted setup recovery; offline run after complete install; no unintended external requests; intended Windows/POSIX launch path actually exercised.

## Acceptance measures

Choose numeric tolerances with the user/device needs, then measure them. Examples of quantities to record are stance-foot drift in centimeters over a stance phase, maximum foot penetration, average/p95 frame time, initial load time, downloaded bytes, draw calls and renderer resource counts before/after lifecycle cycles. Do not convert these suggestions into invented benchmark results or universal thresholds.

Visual emotion readability and realism also require human/artistic judgment. A six-image contact sheet can support review, but a single front screenshot cannot validate movement. Keep videos long enough to show transitions and repeated cycles.

## Triage table

| Symptom | Inspect first | Do not do blindly |
|---|---|---|
| Face sliders change numbers but face is static | Target bindings, actual deltas, final ownership and weights | Add more UI buttons |
| Morphs vanish after emotion switch | All-morph reset; identity/expression ownership | Zero every target |
| A/T pose or twisted shoulders | Reference pose, semantic mapping, local axes/roll, parent transforms | Increase IK strength |
| Walking backward | Model forward and camera movement convention | Negate every animation quaternion |
| Feet slide | Actual velocity, source root drift, cycle phase, stride scale | Freeze both feet permanently |
| Knee flips or NaNs | Reach limits, zero vectors, knee pole and fresh pose | Stretch bone lengths |
| Avatar floats/sinks | Foot sole offsets, scaling, bind stance, support query | Hard-code old sample Y offset |
| Jaw/teeth separate | Hybrid jaw double application, teeth skin/parenting | Clamp all expressions to tiny values |
| Close-up clips face | Eye/head anchor, radius/near plane, collision volume | Turn off depth testing |
| Works online, fails offline | External textures, decoder paths, runtime imports and cache integrity | Call it offline-ready |
| Works alone, breaks host | Second renderer/RAF, globals, shared mutable skeleton | Rewrite unrelated host systems |
| Works once, fails on remount | Listener/observer/resource cleanup and async load race | Reload entire page as the only fix |

## Packaging checklist

Bundle source, resolved profile, permitted runtime assets or a clearly labeled installer, versions/lockfile or pinned downloads, source/provenance manifest, separate third-party notices, tests, report, minimal sandbox, host integration example and plain-language run guide. Include the public runtime interface actually implemented, not just a declaration that nobody tested. Explain which files are optional reference versus runtime requirements.

An original source ZIP with external downloads is a starter, not a fully installed avatar. A profile template is a specification, not generated geometry. A skill ZIP is instructions/resources, not automatically installed or permanently learned by every GPT.

## Agent-evaluation scenarios

`evals/scenarios.json` contains prospective prompts/rubrics for testing whether a future agent follows this workflow. They are **not an executed model benchmark**. Run them with a real coding agent and available tools to evaluate adherence. Reward actual artifacts and honest test status, not confident language.


---

# FILE: avatar-threejs-builder/references/07-source-audit.md

# 07 — Source audit and provenance boundary

## Inputs inspected

Source: the user-conversation artifact `AvatarMotionLab-Starter.zip`, extracted into `assets/reference-project/`. This copy is a frozen source snapshot, not a newly generalized runtime. `source-snapshot-manifest.json` records the original ZIP hash and each source file hash. No binary avatar, motion pack, Three.js distribution or font is bundled in that snapshot.

For package-build checks and current test results read the outer `validation/REPORT.md`. The old report remains unchanged inside the snapshot. The old UI-shell checks are historical evidence only; they are not rerun or upgraded to real WebGL evidence by this package.

## Source map

| File | Actual responsibility |
|---|---|
| `tools/setup.mjs` | Pinned r180/0.180.0 engine download, AvatarSDK sample, motion extraction, provenance/cache |
| `tools/glb.mjs` | Compact GLB reader and idle/walk/run extraction; rejects cubic motion tracks |
| `src/actor.mjs` | Load GLB; force 1.78 m bounds height; normalize aliases; collect meshes/bones/morphs |
| `src/physics.mjs` | Fixed-parameter character movement, jump state, circle/box collision and ground tops |
| `src/animation.mjs` | Custom world-space retarget bake, gait blending, overlays and two-bone foot adjustment |
| `src/expressions.mjs` | Six preset dictionaries, blink, gaze, manual controls and morph application |
| `src/camera.mjs` | Portrait/follow/orbit camera, smooth target, single-ray blocker check |
| `src/input.mjs` | Keyboard/mouse listeners and focus handling |
| `src/world.mjs` | Procedural test world and lights |
| `src/main.mjs` | DOM/UI, loading, fixed-step accumulator, renderer loop and debug singleton |
| `start.mjs` | Loopback-only HTTP server and first-run setup |
| `tests/*.mjs` | 36 source tests for math/controller/face logic/GLB extractor/server |

## Provenance facts

The reference model is a pre-existing AvatarSDK male sample, pinned to TalkingHead commit `2afe6d79779313db8909badebf46f9805a6c7b70`, blob `2865a45b9f82e97e811cc703411233f3be780163`. The source notice identifies non-commercial use. These identifiers are for historical reproduction only; do not impose this identity or licensing constraint on all future avatars. A new correctly licensed asset can be selected.

Motion uses the Three.js r180 Xbot example's idle/walk/run data. The retarget implementation is custom, not `SkeletonUtils.retargetClip`, and body length is preserved in the target. Jump/landing/breathing are procedural overlays, not captured new motion. Asset/model visual tests were not completed in the original environment.

## Deliberate improvements in this skill

These are **requirements for the adapting agent**, not claims that the source already implements them:

| Original behavior or risk | Required generalization |
|---|---|
| Fixed male sample path, 1.78 m normalization, fixed collider/camera offsets | Per-avatar art brief, asset adapter, measured proportions and explicit units |
| `Map.set` during normalized bone collection can overwrite duplicate aliases | Detect ambiguous bones; resolve exact IDs/paths before animation |
| Body gate checks limited bones and retarget count >=15 | Check semantic limb-chain coverage and visual alignment, not count alone |
| Face gate accepts any morph, then warns about a small asymmetric essential list | Bilateral, per-expression coverage and visible unsupported status |
| `FaceRig.apply` sets all discovered morphs, defaulting unrelated ones to zero | Write only owned expression targets; preserve identity/corrective/speech weights |
| Blink masks desired eye-wide before smoothing | Resolve the final eyelid composition, then verify actual closure |
| Material name heuristics change roughness and transparency globally | Explicit material-role adapter; preserve imported appearance |
| `frustumCulled=false` on all meshes | Correct animated bounds or an intentional measured culling policy |
| Center-ray camera collision | Near-plane-aware/multi-ray/volume check for production corners |
| Box-top collision demo | Explicit support limits; adequate solver for slopes/ceilings/platforms |
| Foot solver uses a fixed lower distance bound | Length-dependent reachable interval and near-zero-vector checks |
| Globals/DOM coupling, `window.__avatarLab`, no complete instance disposal API | Host-owned loop, injectable dependencies, independent instances and cleanup |
| Some untracked-bone overlays may accumulate without a fresh complete base pose | Restore/snapshot base pose for every procedurally written bone each frame |
| Readiness checks mainly file existence/size; some cached files unverified | Validate integrity/dependencies before claiming ready/offline |
| Download fetch has a byte limit; curl fallback is less constrained | Enforce size and integrity limits consistently on every download route |
| Old tests validate existing behavior, including clearing unrelated morphs | New regression tests must reflect the improved ownership contract |

These findings do not mean every listed risk necessarily manifests on the historical model. Some are source-level limitations requiring verification or generalization. Do not present them as observed visual bugs without rendering evidence.

## What remains unverified

This skill delivery does not add a sculpt, a commercial license, a new animation capture, a downloaded GLB or a fresh end-to-end rendering test. The generalized runtime API is a specification for future implementation. The included metadata tools and tests have their own narrower checks; see the package report.

## Why include the old source

It gives the next agent exact implementation evidence: state equations, composition logic, input/camera behavior and original asset handling. Read it together with this audit so the agent can reproduce the useful pattern without preserving identity-specific constants, integration coupling or misleading test assumptions.


---

# FILE: avatar-threejs-builder/references/SOURCES.md

# Sources and verification notes

Checked for this package: 22 October 2026. Documentation and service interfaces can change. Pin the runtime version used by the project; recheck current platform installation guidance before automating installation.

The primary evidence for the original method is the bundled source snapshot and its hashes, not a reconstructed memory of the previous conversation. The technical architecture and new API are design recommendations derived from that source.

## Primary technical sources

- **[S1] Khronos glTF 2.0 specification.** Skins, morph targets, animation, GLB container, scene structure and metadata. https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- **[S2] Three.js SkinnedMesh.** Skeleton, skin indices/weights, bind matrices and animated bounds. https://threejs.org/docs/pages/SkinnedMesh.html
- **[S3] Three.js Mesh.** `morphTargetDictionary` and `morphTargetInfluences`. https://threejs.org/docs/pages/Mesh.html
- **[S4] Three.js GLTFLoader.** Import, decoder/texture-loader integration and bitmap disposal note. https://threejs.org/docs/pages/GLTFLoader.html
- **[S5] Three.js SkeletonUtils.** Skeleton cloning/retargeting utilities; check the project's pinned version. https://threejs.org/docs/pages/module-SkeletonUtils.html
- **[S6] Three.js AnimationMixer.** Per-object animation control. https://threejs.org/docs/pages/AnimationMixer.html
- **[S7] Three.js AnimationAction.** Playback weights, times, fades and loop controls. https://threejs.org/docs/pages/AnimationAction.html
- **[S8] Original sample provenance.** URLs, commits and rights caveats are preserved in `assets/reference-project/THIRD_PARTY_NOTICES.md`. The sample binary is not included and was not rendered during this skill build. Historical source URL: https://github.com/met4citizen/TalkingHead/blob/2afe6d79779313db8909badebf46f9805a6c7b70/README.md

## Primary agent-platform sources

- **[P1] OpenAI Build skills.** `SKILL.md` metadata, progressive disclosure, local `.agents/skills` discovery and optional `agents/openai.yaml`. https://developers.openai.com/codex/build-skills (also https://learn.chatgpt.com/docs/build-skills)
- **[P2] OpenAI AGENTS.md guidance.** Repository-level instructions and discovery. https://developers.openai.com/codex/agent-configuration/agents-md
- **[P3] OpenAI Creating and editing GPTs.** Instructions versus reference Knowledge; test in Preview. https://help.openai.com/en/articles/8554397-creating-and-editing-gpts
- **[P4] OpenAI Projects in ChatGPT.** Shared project files and instructions. https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- **[P5] OpenAI Custom GPT retirement and migration FAQ.** Account-dependent transition to plugins; current notice gives 11 December 2026 retirement, with some approved Enterprise deferrals. This package does not assume access to any migration/import UI. https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq
- **[P6] OpenAI Skills API guide.** Runtime-specific attachment of reusable instructions/files. https://developers.openai.com/api/docs/guides/tools-skills
- **[P7] OpenAI Testing Agent Skills Systematically.** Prompt/rubric evaluation of a skill. https://developers.openai.com/blog/eval-skills

## Limits on source interpretation

The glTF/Three.js docs establish available format/runtime mechanisms, not proof of a particular avatar's realism. This package's preset weights, animation tuning and quality gates are engineering/art direction choices. The current Three.js docs may describe features absent from the original r180 source; do not mix addon versions. The standalone package is not an officially registered plugin or automatically installed skill.


---

# FILE: avatar-threejs-builder/assets/avatar-profile.template.json

```json
{
  "schemaVersion": "1.0.0",
  "id": "replace-with-project-avatar-id",
  "appearance": {
    "description": "Describe the requested character without changing the common runtime contract.",
    "ageAppearance": null,
    "presentation": null,
    "bodyProportions": null,
    "skin": null,
    "face": null,
    "eyes": null,
    "hair": null,
    "facialHair": null,
    "clothing": null,
    "style": "realistic"
  },
  "assets": {
    "model": null,
    "motionSources": [],
    "provenanceManifest": "asset-manifest.json"
  },
  "normalization": {
    "units": "meters",
    "upAxis": "+Y",
    "canonicalForward": "+Z",
    "sourceForward": null,
    "targetHeightMeters": null,
    "sourceUnitsToMeters": null
  },
  "rig": {
    "adapter": "humanoid-v1",
    "requiredRoles": [
      "hips",
      "spine",
      "head",
      "leftUpperArm",
      "leftLowerArm",
      "leftHand",
      "rightUpperArm",
      "rightLowerArm",
      "rightHand",
      "leftUpperLeg",
      "leftLowerLeg",
      "leftFoot",
      "rightUpperLeg",
      "rightLowerLeg",
      "rightFoot"
    ],
    "bones": {},
    "referencePose": "inspect-asset",
    "preserveTargetBoneLengths": true
  },
  "face": {
    "driver": "morph",
    "defaultEmotion": "smile",
    "intensity": 0.88,
    "response": 7.5,
    "presets": "facial-presets.json",
    "requiredChannels": [
      "jawOpen",
      "mouthSmileLeft",
      "mouthSmileRight",
      "mouthFrownLeft",
      "mouthFrownRight",
      "browInnerUp",
      "browDownLeft",
      "browDownRight",
      "browOuterUpLeft",
      "browOuterUpRight",
      "eyeBlinkLeft",
      "eyeBlinkRight",
      "eyeWideLeft",
      "eyeWideRight"
    ],
    "bindings": {},
    "ownership": "mapped-expression-channels-only",
    "preserveUnownedMorphs": true,
    "blink": {
      "enabled": true,
      "closeSeconds": 0.07,
      "holdSeconds": 0.033,
      "openSeconds": 0.137,
      "waitMinSeconds": 2.4,
      "waitMaxSeconds": 5.5
    },
    "gaze": {
      "enabled": true,
      "driver": "inspect-asset",
      "maxYawRadians": 0.45,
      "maxPitchRadians": 0.35
    },
    "microMotion": {
      "enabled": true,
      "seed": 1952
    }
  },
  "movement": {
    "rootMotion": "in-place",
    "fixedStepSeconds": 0.008333333333333333,
    "maxSubsteps": 12,
    "walkSpeedMps": 1.52,
    "runSpeedMps": 4.25,
    "accelerationMps2": 8.5,
    "brakingMps2": 12.5,
    "gravityMps2": 18.8,
    "jumpSpeedMps": 5.6,
    "coyoteSeconds": 0.1,
    "jumpBufferSeconds": 0.18,
    "anticipationSeconds": 0.095,
    "landingSeconds": 0.25,
    "colliderRadiusMeters": null,
    "colliderHeightMeters": null,
    "stepHeightMeters": null,
    "footIK": true
  },
  "camera": {
    "enabled": true,
    "initialMode": "portrait",
    "movementExitsPortrait": true,
    "deriveAnchorsFromRig": true,
    "manualInputPriority": true,
    "collisionMode": "near-plane-aware",
    "portraitFovDegrees": 31,
    "orbitFovDegrees": 43,
    "followFovDegrees": 47,
    "runFovAdditionDegrees": 7,
    "recenterDelaySeconds": 1.7
  },
  "quality": {
    "priority": "face-deformation-and-readability",
    "targetDevice": null,
    "targetFps": null,
    "maxDownloadBytes": null,
    "pixelRatioCap": 1.4,
    "reducedMotion": false
  },
  "deployment": {
    "commercialUse": null,
    "offlineAfterSetup": true,
    "allowExternalPersonalDataUpload": false,
    "hostOwnsRenderLoop": true,
    "threeVersion": null
  },
  "notes": [
    "Draft template, not a resolved asset profile.",
    "The original application does not consume this profile until an adapter is implemented.",
    "Appearance fields are an art brief, not automatic mesh-generation parameters.",
    "Motion numbers reproduce prototype tuning; recalibrate for the actual rig."
  ]
}

```


---

# FILE: avatar-threejs-builder/assets/facial-presets.json

```json
{
  "schemaVersion": "1.0.0",
  "status": "Initial artistic calibration copied from source; visual validation required per asset.",
  "defaultEmotion": "smile",
  "defaultIntensity": 0.88,
  "ownership": "mapped-expression-channels-only",
  "emotions": {
    "neutral": {
      "label": "خنثی",
      "key": "0",
      "icon": "neutral",
      "values": {}
    },
    "smile": {
      "label": "لبخند آرام",
      "key": "1",
      "icon": "smile",
      "values": {
        "mouthSmileLeft": 0.24,
        "mouthSmileRight": 0.24,
        "cheekSquintLeft": 0.1,
        "cheekSquintRight": 0.1,
        "eyeSquintLeft": 0.05,
        "eyeSquintRight": 0.05
      }
    },
    "laugh": {
      "label": "خنده",
      "key": "2",
      "icon": "laugh",
      "values": {
        "mouthSmileLeft": 0.82,
        "mouthSmileRight": 0.82,
        "cheekSquintLeft": 0.4,
        "cheekSquintRight": 0.4,
        "eyeSquintLeft": 0.33,
        "eyeSquintRight": 0.33,
        "mouthUpperUpLeft": 0.15,
        "mouthUpperUpRight": 0.15,
        "mouthLowerDownLeft": 0.12,
        "mouthLowerDownRight": 0.12,
        "jawOpen": 0.3
      }
    },
    "sad": {
      "label": "ناراحتی",
      "key": "3",
      "icon": "sad",
      "values": {
        "browInnerUp": 0.7,
        "browDownLeft": 0.18,
        "browDownRight": 0.18,
        "mouthFrownLeft": 0.72,
        "mouthFrownRight": 0.72,
        "mouthShrugLower": 0.1,
        "eyeSquintLeft": 0.11,
        "eyeSquintRight": 0.11,
        "mouthPressLeft": 0.12,
        "mouthPressRight": 0.15
      }
    },
    "angry": {
      "label": "عصبانیت",
      "key": "4",
      "icon": "angry",
      "values": {
        "browDownLeft": 0.84,
        "browDownRight": 0.84,
        "eyeSquintLeft": 0.28,
        "eyeSquintRight": 0.28,
        "noseSneerLeft": 0.28,
        "noseSneerRight": 0.28,
        "mouthPressLeft": 0.36,
        "mouthPressRight": 0.36,
        "jawForward": 0.1,
        "jawOpen": 0.035,
        "mouthFrownLeft": 0.12,
        "mouthFrownRight": 0.12
      }
    },
    "surprise": {
      "label": "تعجب",
      "key": "5",
      "icon": "surprise",
      "values": {
        "browInnerUp": 0.78,
        "browOuterUpLeft": 0.83,
        "browOuterUpRight": 0.83,
        "eyeWideLeft": 0.8,
        "eyeWideRight": 0.8,
        "jawOpen": 0.52,
        "mouthFunnel": 0.17,
        "mouthLowerDownLeft": 0.1,
        "mouthLowerDownRight": 0.1
      }
    }
  }
}

```


---

# FILE: avatar-threejs-builder/assets/runtime-contract.d.ts

```typescript
/** DESIGN CONTRACT ONLY. The reference-project does not implement this factory yet.
 * Implement it in the new host and run lifecycle/independence tests before claiming support.
 * Three.js is a host peer dependency; match its pinned runtime/addon versions.
 */
import type { Object3D, Scene, Vector3, WebGLRenderer } from 'three';
export type Emotion = 'neutral' | 'smile' | 'laugh' | 'sad' | 'angry' | 'surprise';
export type CameraMode = 'portrait' | 'follow' | 'orbit';
export interface MoveInput {
  x: number;                 // -1..1, strafe in the camera-relative plane
  forward: number;           // -1..1
  run: boolean;
  jumpPressed: boolean;      // rising edge, not held-key state
  cameraYawRadians: number;
}
export interface SupportHit { point: Vector3; normal: Vector3; colliderId: string; }
export interface CollisionAdapter {
  /** Host-specific grounded-motion solve; do not implement this with an unchecked teleport. */
  moveCharacter(request: {
    position: Vector3; displacement: Vector3;
    radiusMeters: number; heightMeters: number; stepHeightMeters: number;
  }): { position: Vector3; supported: boolean; ceilingHit: boolean };
  supportAt(position: Vector3, maxDropMeters: number): SupportHit | null;
}
export interface AvatarDependencies {
  scene: Scene;
  renderer: WebGLRenderer;   // borrowed; never dispose it from avatar.dispose()
  world: CollisionAdapter;
  assetBaseUrl: string;
  signal?: AbortSignal;
  onProgress?: (event: { phase: string; loadedBytes?: number; totalBytes?: number }) => void;
  onDiagnostic?: (event: { level: 'info'|'warning'|'error'; code: string; message: string }) => void;
}
export interface AvatarInspection {
  id: string;
  assetSha256: string | null;
  movementState: string;
  positionMeters: [number,number,number];
  speedMps: number;
  grounded: boolean;
  emotion: Emotion;
  missingBones: string[];
  missingFaceChannels: string[];
  ambiguousMappings: string[];
  finalExpressionWeights: Record<string,number>;
  disposed: boolean;
}
export interface AvatarRuntime {
  readonly root: Object3D;
  setInput(input: MoveInput): void;
  /** Host calls once per display frame; runtime owns only its bounded fixed-step accumulator.
   * Do not also advance the same controller/mixer elsewhere in the host.
   */
  update(deltaSeconds: number): void;
  setExpression(emotion: Emotion, intensity?: number): void;
  setFaceOverride(channel: string, value: number | null): void;
  clearFaceOverrides(): void;
  blink(): void;
  setGazeTarget(worldPoint: Vector3 | null): void;
  reset(options?: { positionMeters?: [number,number,number]; yawRadians?: number; resetFace?: boolean }): void;
  getAnchors(): { eyes: Vector3; head: Vector3; body: Vector3 };
  inspect(): AvatarInspection;
  /** Idempotent; releases only instance-owned resources/listeners. */
  dispose(): void;
}
/** Implement this factory; declaration alone provides no runtime behavior.
 * Validate profile against avatar-profile.schema.json before initialization.
 * Camera and keyboard adapters remain optional separate host components.
 */
export declare function createAvatar(
  profile: Readonly<Record<string, unknown>>,
  dependencies: AvatarDependencies
): Promise<AvatarRuntime>;

```


---

# FILE: avatar-threejs-builder/assets/asset-manifest.template.json

```json
{
  "schemaVersion": "1.0.0",
  "status": "draft",
  "assets": [
    {
      "id": "avatar-model",
      "kind": "model",
      "localPath": null,
      "sourceUri": null,
      "revision": null,
      "sha256": null,
      "bytes": null,
      "author": null,
      "licenseOrTerms": null,
      "termsReference": null,
      "reviewStatus": "not-reviewed",
      "commercialPermission": "unknown",
      "redistributionPermission": "unknown",
      "notes": "Code license does not automatically license the model, textures or motion."
    }
  ],
  "codeLicense": null,
  "decoderNotices": []
}

```


---

# FILE: avatar-threejs-builder/assets/handoff-state.template.json

```json
{
  "schemaVersion": "1.0.0",
  "projectRoot": null,
  "requestSummary": null,
  "resolvedProfile": null,
  "assetHashes": {},
  "completedGates": [],
  "pendingGates": [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H"
  ],
  "decisions": [],
  "actualTestEvidence": [],
  "licenseBlockers": [],
  "toolLimitations": [],
  "nextVerifiableAction": null,
  "warnings": [
    "A previous agent summary is not execution evidence. Inspect the files."
  ]
}

```


---

# FILE: avatar-threejs-builder/assets/TEST-REPORT.template.md

```markdown
# Avatar verification report

Status: NOT RUN — fill only with actual evidence.

## Build identity
Project/revision:
Profile path and hash:
Model path and SHA-256:
Motion assets and hashes:
Engine/addon versions:
Test date:
Browser / OS / GPU / viewport / pixel ratio:

## Commands and environment
Record exact commands, exit codes, raw-log paths and actual blockers.

## Results
| Category | Status (pass/fail/blocked/not-run/not-applicable) | Evidence path | Scope/limitation |
|---|---|---|---|
| Profile / metadata | not-run | | |
| Deterministic unit tests | not-run | | |
| Server / first install | not-run | | |
| Real WebGL asset load | not-run | | |
| Six expressions / blink / gaze | not-run | | |
| Gait / jump / foot contact | not-run | | |
| Camera and input | not-run | | |
| Two-instance independence | not-run | | |
| Spawn/dispose lifecycle | not-run | | |
| Offline repeat launch | not-run | | |
| Performance | not-run | | |
| Rights review | not-run | | |

## Measured values
Frame time avg/p95, memory, bytes, load times, foot drift/penetration:
Do not fill with target budgets or guessed results.

## Visual evidence
Screenshots: six real face renders, neutral three-quarter/profile.
Recordings: actual locomotion/transitions/camera and IK comparison.
Reviewer observations and remaining artifacts:

## Release decision
Unmet user requirements:
Blocked gates and next concrete checks:
Permitted deployment scope and unresolved licenses:
Prototype / verified demo / production candidate (choose only with evidence):

```


---

# FILE: avatar-threejs-builder/assets/AGENTS.example.md

```markdown
# Avatar tasks in this repository

For full-body Three.js avatar, locomotion, rigging, facial expression or camera tasks,
read `.agents/skills/avatar-threejs-builder/SKILL.md` before implementing changes.
Use its source-audit reference to distinguish original code from proposed generalization.

Preserve this repository's renderer, render loop and conventions. Do not hard-code an
identity, sample height, restricted model or commercial-rights assumption. Keep appearance,
asset mappings and behavior separate. Do not reset identity morphs to change emotions.

Create actual runnable artifacts when tools allow. Report unit, metadata, browser,
visual and performance verification separately. Never turn “not run” into “passed”.
Do not replace the existing AGENTS.md; merge this narrow section with project guidance.

```


## Companion-package boundary

The full JSON Schema, utility scripts, original source, source hashes and executed test logs live in the complete ZIP. Their existence does not mean they are available in this single attachment. Ask for the companion files only when needed for execution; do not stall conceptual work that can proceed from this guide. Do not invent script results or pretend that the original project already implements the new profile/API.
