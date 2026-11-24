# Portable Customizable Web Avatar Builder — 1.1.0

This is consolidated guidance, profile and calibration math. The complete ZIP also contains the schema, inspectors, tests and historical source. It does not include character binaries or grant tools, assets or installation. Appearance is the user's input; Al-Amr is optional.


<a id="resource-1"></a>

## Resource: SKILL.md

---
name: avatar-threejs-builder
description: "Build or repair customizable full-body web avatars with Three.js: rig and motion adapters, facial emotions, natural hands and posture, and calibrated shoe-ground contact. Use for new characters, GLB integration, retargeting, floating heels, splayed fingers or expressive faces in any web host. Not for portrait images or talking-head video generation."
metadata:
  version: "1.1.0"
  language: "en"
  provenance: "Historical Motion Lab snapshot plus generalized lessons from an accepted hybrid; no character assets included"
---

# Customizable Web Avatar Builder

Build the user's character and a reusable web runtime. Identity, clothes, proportions and style are inputs; preserve the common full-body rig, locomotion, jump, facial-emotion and lifecycle architecture. Plain Three.js, React Three Fiber and other compatible web hosts are valid. Al-Amr, a particular male character, 1.78m height, purple clothes, exactly 66 morphs, fixed motion speeds or two separate rigs are not requirements.

This skill is an engineering/authoring workflow, not a text-to-3D model or a prebuilt avatar factory. Appearance text needs an actual selected or authored asset. Never present a portrait image, parameter file or static mesh as a completed expressive rig.

## Select the relevant references

Read the user's brief and host conventions. Load only the needed references:

| Work | Read |
|---|---|
| Structure, coordinate conventions, semantic mapping | [01-contract-and-anatomy.md](#resource-2) |
| Choose/create an identity, clothing, export and asset rights | [02-assets-and-authoring.md](#resource-3) |
| Native clips, retargeting, state/phase and jump | [03-body-animation.md](#resource-4) |
| Six emotions, blink/gaze, per-mesh channels and ownership | [04-face-animation.md](#resource-5) |
| Renderer, camera, host and lifecycle | [05-camera-rendering-integration.md](#resource-6) |
| Tests, measurements and delivery | [06-validation-and-delivery.md](#resource-7) |
| Copying the historical example | [07-source-audit.md](#resource-8) |
| Full-body build, heel/toe contact, hands, shoulders or neck defects | [08-contact-and-posture.md](#resource-9) |
| Identity sculpting or combining a body and a facial rig | [09-customization-and-hybrid.md](#resource-10) |

`assets/reference-project/` is an unchanged historical r180 example with known limitations. `assets/runtime-kernel/` contains tested, dependency-free calibration math; it is not a skinning/IK engine. The profile and TypeScript contract are adapter designs to implement. Do not inherit the example's identity, licenses, passes or universal renderer compatibility. Source facts and generalization guidance are separated in the source audit.

## Establish inputs

Use `assets/avatar-profile.template.json`. Keep the art brief (`appearance`) separate from actual files (`assets`), coordinate/rig mappings, per-role motion sources, contact/posture calibration and face channels. Ask only for information that materially changes the work and is unavailable; record nonblocking choices as provisional. A reference photo is optional unless likeness requires it. `null` means unresolved, never a fabricated asset, hash or capability.

Prefer a compatible user-provided/authorized asset. If a custom model is needed, use available 3D authoring tools to build/rig/skin it. Preserve a usable body rig and native clips. If facial topology or finger chains are missing, author or replace that component, or mark the requested capability incomplete. A skill does not grant external-service upload, account, purchase, publication or repository permissions.

```sh
python scripts/validate_profile.py assets/avatar-profile.template.json
python scripts/inspect_glb.py PATH_TO_MODEL.glb --profile PATH_TO_PROFILE.json --out asset-audit.json
```

Run relative to this skill. Metadata checking does not decode deformation, inspect textures or prove an expressive face. See `scripts/README.md` for exact scope.

## Implement in this order when building a new avatar

1. **Inspect and normalize.** Inventory real joints, skins, parts, morphs, clips, resources and rights. Resolve ambiguous names explicitly. Calibrate units/forward/neutral stance through an outer model group while preserving bind matrices and segment lengths. Derive height/anchors from body landmarks, not raised hands or hair bounds.
2. **Adapt motion.** Map roles to actual sources and loop/one-shot behavior. Prefer native playback for compatible clips; retarget only differing sources using verified reference-pose/anatomical frames. The controller owns world pose once. Use achieved velocity, calibrated stride timing and explicit jump/landing states. Exit preview before resuming keyboard/controller locomotion.
3. **Calibrate feet and hands.** Read reference08. Measure current deformed heel/forefoot support patches in world space. Separate static stance, gait support, swing and airborne phases. Correct ankle/toe orientation and reachable leg placement within per-avatar limits; release overrides in the air. Check both hands in front/side views; calibrate mirrored palm/flexion axes separately and relax fingers only on owned states. Preserve gestures, held props and tracking. Inspect wrists, shoulders and forward neck in the same pose.
4. **Build the expressive face.** Bind per-mesh channels, preserve identity/corrective/external speech weights, and expose neutral/smile/laugh/sad/angry/surprise with intensity/manual controls. Start from the user's desired state; otherwise use neutral for inspection. Compose mood, overrides, blink and gaze with explicit priorities. A slider must cause real deformation. Missing core channels require authoring or an explicit incomplete status.
5. **Customize without breaking deformation.** Use reference09 for new identity/face/clothes. Preserve native eyelid/lip topology. For a point warp F, transform every relative morph as F(base+delta)-F(base), including required normal/attachment work. A separate facial skeleton must follow the current body neck/torso chain dynamically, including sitting and running.
6. **Integrate and verify.** The host owns renderer, camera, input, navigation, world pose and global frame loop. The avatar owns private mutable animation/face state and releases only owned resources. Match pinned Three core/addons/renderer. Show the actual selected asset in a local inspection scene and test the requested features, not an unrelated historical demo.

Existing-asset repairs can start at the affected subsystem; avoid rebuilding unrelated appearance or working motion.

## Non-obvious invariants

- Evaluate a fresh base pose before additive posture, finger and contact corrections. Never accumulate the same offset each frame.
- Grounded root/collider does not prove grounded shoes. Measure skinned contact geometry; include heel **and** forefoot and the actual footwear design. Do not flatten high heels or force swing/jump feet to the floor.
- Identical bone names do not imply identical axes. Preserve helper/twist chains, lengths, reference corrections and quaternion order. Missing fingers stay unsupported; a 41-bone body does not gain five articulated fingers from a separate 73-bone face donor.
- Do not transfer expressions to a sealed neutral face by nearest-surface matching and assume equivalence. Protect mouth/eyelid topology, teeth, lashes and the neckline through combined body/face poses.
- Shared geometry/materials require ownership. Clone mutable resources before sculpting/masking; independent instances and cached source data must remain intact.
- Separate code and model/texture/motion/decoder rights. Restricted example assets are optional historical references; their restrictions do not become a universal license for other user assets.

## Acceptance and handoff

Use the test/report templates and reference06. For contact/posture work, record heel/forefoot residual, penetration, stance drift, knee reach, hand silhouette and side-view alignment across relevant clips/phases. Use scale-appropriate, declared tolerances; historical millimeter results do not certify a new avatar. Check front/side/three-quarter neutral, all six emotions, blink during surprise, sit/bend/run and jump release when those features are in scope.

Deliver runnable source, local assets or a clearly labeled authorized installer, resolved mappings/profile, provenance, controls, actual tests/evidence and the implemented runtime API. `assets/runtime-contract.d.ts` is a design, not an implementation. Use `assets/handoff-state.template.json` to record what is pass/fail/blocked/not-run and the next verifiable step.

For this skill's utilities: `python -m unittest discover -s tests -v` and `node --test tests/calibration.test.mjs`. These check metadata/configuration and synthetic math, not a new character render. Run new-asset visual/performance checks on that actual asset; preserve previously accepted outputs and avoid unrelated demonstrations. State missing authoring/runtime access honestly while completing independent useful work.


<a id="resource-2"></a>

## Resource: references/01-contract-and-anatomy.md

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


<a id="resource-3"></a>

## Resource: references/02-assets-and-authoring.md

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


<a id="resource-4"></a>

## Resource: references/03-body-animation.md

# 03 — Body animation, controller and foot contact

For full-body builds and foot/hand repairs, also read [08-contact-and-posture.md](#resource-9). Prefer genuine native clips for the selected body. Map idle/walk/run/jump plus requested optional gesture/sit/flight roles in `motionRoles`; historical donors, labels and speeds below are not mandatory.

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

Measure deformed heel and forefoot support patches before and after IK. Root support, a foot-bone coordinate or an undeformed bounding box does not prove sole contact. Static ankle/toe correction, gait stance locking and airborne release have separate owners; retain high-heel geometry and intentional toe-off. See reference08 for bounded corrections and per-side hand/rest anatomy. The two-patch kernel is a sagittal proposal, not full leg IK or a terrain-contact engine.

Use two-bone inverse kinematics (IK: solving joint angles so a foot reaches a target). Derive thigh/shin lengths from the current target rig. Query the actual support surface under each foot, not only under the pelvis. Lock a foot only during a plausible stance phase. Unlock for swing, takeoff, teleport, reset, excessive reach or changing platform support.

Clamp hip-to-ankle distance to `[abs(thighLength-shinLength)+epsilon, thighLength+shinLength-epsilon]`. Keep a stable knee bend direction and a valid fallback when vectors are near zero. Do not stretch the leg, hyperextend knees or solve with NaNs. On sloped ground, align sole orientation to the support normal only when that feature exists. The reference does not implement a full slope-aware sole solver.

Blend IK strength and, where needed, a small pelvis offset. A foot lock is not universal: the source's height-based heuristic can misclassify stance and needs per-clip visual verification.

## Required evidence

Record idle, eight-direction movement, acceleration, start/stop, walk/run changes, sharp turns, wall pushes, step traversal, stationary/moving jumps and loss of support. Review at normal speed and slow motion. Measure foot displacement during stance and penetration depth against project tolerances; do not fabricate a “zero foot sliding” claim. Capture with IK on and off to isolate causes.


<a id="resource-5"></a>

## Resource: references/04-face-animation.md

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

Neutral and gentle smile must be independently selectable. The historical demo starts smiling; the generalized template starts neutral for inspection unless requested otherwise. Laughing jaw movement does not imply audio, speech synthesis or lip sync. For a new identity or separate facial rig, read [09-customization-and-hybrid.md](#resource-10): preserve expressive topology, transform all morph endpoints coherently, and synchronize neck/torso anchors in bent/seated poses.

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


<a id="resource-6"></a>

## Resource: references/05-camera-rendering-integration.md

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


<a id="resource-7"></a>

## Resource: references/06-validation-and-delivery.md

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
node --test tests/calibration.test.mjs
```

The frozen source project has its own Node suite:

```sh
cd assets/reference-project
node --test
```

Neither command launches a real 3D render or tests the full generalized runtime contract.

The Python suite covers configuration/declared GLB capabilities, including finger-chain selectors and shoe vertex index bounds. The Node calibration suite covers synthetic heel/forefoot fit, varied scale/ground height, authored high-heel support, airborne release, bounded corrections, reach, fresh-pose offsets and nonlinear morph endpoints. These are not rendered tests of new identities. Original source tests remain separate.

## Manual/browser acceptance matrix

Capture actual screenshots/recordings, not generated illustrations of the intended result. Use one constant asset/lighting configuration when comparing expressions.

- **Asset:** Correct stature/forward/ground offset; neutral pose; independent left/right limbs; eyes, teeth and clothing attached correctly; no missing texture or unsupported-extension errors.
- **Face:** Keys/UI 0–5; intensity 0/0.5/1; front close-up of six states; 3/4/profile neutral and smile; surprise plus full blink; laugh → sad → neutral; valid teeth/jaw motion; no identity morph reset; optional feature labels.
- **Body:** Standing, 8-direction walk/run, acceleration, braking, 180° turn, pressing into walls, steps, stationary/moving jump, falling off support, landing, reset while airborne, IK on/off and repeated cycles without drift.
- **Camera/input:** F/V/C, drag/wheel, corners, wall proximity, start/stop near a wall, portrait-to-follow, keyboard focus in forms, focus loss while holding W/Shift, Escape/cancel interactions as implemented.
- **Reuse:** Two differently proportioned assets using the same runtime; two independent instances; create/remove/recreate loop; no duplicate listeners or second RAF; host survives avatar disposal.
- **Distribution:** Fresh directory launch; missing/corrupt asset message; interrupted setup recovery; offline run after complete install; no unintended external requests; intended Windows/POSIX launch path actually exercised.

## Acceptance measures

For feet/posture, use reference08. Report signed heel/forefoot gaps, penetration, stance drift and correction limits across relevant static/gait/sit/jump phases. Check both hands, shoulders, wrist/torso relation and neck in side view; test gesture/tracking ownership where implemented. Preserve the requested footwear shape. Combine facial expressions with seated/running poses when applicable.

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


<a id="resource-8"></a>

## Resource: references/07-source-audit.md

# 07 — Source audit and provenance boundary

## Revision1.1.0: keep these evidence layers separate

The source tree below remains byte-for-byte the old Motion Lab example, not
AvatarHybrid0.1.2. References08/09 add generalized lessons from the accepted
hybrid: calibrated heel/forefoot contact, state-owned relaxed hands, dynamic
neck anchors and coherent native face sculpting. The dependency-free kernel
has its own synthetic tests. Neither the current character assets nor an
Al-Amr integration are needed by this skill. Do not copy the old demo as a
finished general-purpose factory or inherit its visual/identity defaults.


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


<a id="resource-9"></a>

## Resource: references/08-contact-and-posture.md

# 08 — Shoe contact, natural hands and posture

This is a calibration procedure for a new asset. It generalizes observed fixes; it does not prescribe the old avatar's dimensions, Euler angles or bone names. `assets/runtime-kernel/calibration.mjs` contains small tested math helpers. The adapting agent must implement the rig/terrain bridge and verify actual deformation.

## Diagnose before correcting

Capture the neutral asset with overlays disabled, then the same animation time with each layer enabled separately. Record model/source hash, units, reference pose, root/world transform and clip/phase. Inspect front, both sides and close views of shoes/hands.

| Symptom | Distinguish |
|---|---|
| Toe touches, heel floats | Sole pitch or toe articulation, not just root height |
| Both shoes float equally | Model offset/scale/support origin versus per-foot pose |
| One foot penetrates while the other floats | Asymmetric pose, independent support queries, wrong ankle mapping |
| Knees reverse/bow or ankles roll sideways | Reference axes/roll, knee pole and source/target A/T frames |
| Hands are behind the torso | Shoulder/upper-arm rest mapping and forearm/wrist frame |
| All fingers splay, curl backward or form a fist | Palm normal, flexion sign, mirrored local axes and unsupported chains |
| Head leans forward or neck tears while sitting | Torso/neck pose mapping or a rigid replacement-head mount |

Fix incorrect rig/reference mapping before applying stronger IK or decorative offsets.

## Establish contact geometry

1. Select actual outsole contact patches in a known neutral pose: heel support and forefoot support for each shoe. Include inner/outer forefoot samples when roll matters. Exclude cuffs, upper leather, ankle skin and a toe tip that is intentionally raised. A whole-avatar AABB cannot identify these patches.
2. Store exact mesh identifiers and vertex indices or a documented authoring marker/barycentric attachment pinned to the asset hash. Recalibrate after changing shoe geometry, topology, scale or bind pose. Use each side's anatomy; do not reuse one set of indices on another mesh.
3. Measure **current deformed positions** after base animation and world matrices update. In supported Three versions, `mesh.getVertexPosition(index, point)` includes morph/skinning in mesh-local space; then apply `mesh.matrixWorld`. Verify the pinned version. Do not apply skinning twice. A custom CPU sampler must include morph order, bind matrix, bone matrices/weights and mesh/world transforms [S1–S3].
4. Query support under each patch, with collider identity, support normal, world point and bounded ray/drop range. Reject the avatar's own meshes and invalid/no-hit values. An ankle-height ground query can be a flat-plane prototype; it is not proof of support beneath a shoe on stairs.
5. Calibrate intended clearances. Flat trainers, bare feet and high heels have different contact patches. For high heels, measure heel tip and forefoot; retain the authored raised arch/ankle geometry. Never rotate every ankle to identity or force every outsole vertex to height zero.

World-space residual against a local support plane is
`gap = dot(deformedPoint - supportPoint, supportNormal) - intendedClearance`.
Positive means above intended clearance; negative means a clearance deficit. Physical penetration uses the unadjusted support plane, separately from intended clearance. Preserve both measures and per-patch extrema. A low percentile can reject noisy vertices only when documented and not hiding penetration.

## Distinguish support phases

Static standing/seated contact, gait stance, swing, toe-off, jump/fall, flight and a deliberate foot gesture have different owners. Maintain per-foot contact weights from clip events or a calibrated phase classifier. Root grounded alone does not mean both feet should be locked.

- Static stance can use bounded ankle/foot/toe alignment followed by residual translation/IK refinement.
- Gait stance can preserve a world/platform-relative planted position with a bounded lock. Preserve heel lift during toe-off and allow swing clearance.
- Jump/fall/flight disables static corrections and stale locks immediately; do not blend an old ground pin into a donor jump. Land only once support actually returns.
- Reset, teleport, rig/asset replacement, support loss or a platform change clears history.
- A moving support needs a contact point stored in the support's frame; a fixed world lock is incorrect there.

Clip preview is an explicit mode. Before real movement/jump resumes, clear its pose override and restore playback. A physical root jumping while the body remains in a sitting preview is a failed transition even when the root trajectory looks correct.

## Solve bounded corrections

Evaluate a fresh native/retargeted base pose first. Keep base pose, contact offset and temporal lock state separate.

For a stable locally planar support, estimate the shoe's pitch/roll from calibrated contact patches and its desired support orientation. Convert the correction through the actual foot's parent/world frame. Preserve intentional toe articulation unless a calibrated static contact layer owns it. Never assume local X/Z correspond to anatomical pitch/roll on both shoes.

`fitSoleContacts` solves a **two-point sagittal pitch and vertical shift** around an explicit pivot, with required angle/shift bounds and partial weight. Its sign convention is positive rotation raising positive `along` (heel-to-forefoot). Convert that to the asset's calibrated quaternion frame. It does not solve roll, knee IK, discontinuous terrain, moving-platform history or weight distribution. It reports residuals/limits rather than manufacturing a pass. Resample support after rotating if terrain changes under the patch.

For full-leg placement, use a two-bone or host IK solver with measured thigh/shin lengths and a stable knee pole. Clamp target distance to
`[abs(thigh-shin)+epsilon, thigh+shin-epsilon]`, with epsilon proportional to rig scale. Preserve segment translations/bind matrices and knee bend direction. A nonuniformly scaled hierarchy requires explicit treatment; do not reuse uniform-scale equations blindly. A small bounded pelvis adjustment may help bilateral support; the world controller still owns root translation.

Update world/skinning matrices and remeasure actual shoe vertices after applying the correction. Iterate only a small bounded number of times. Keep unreached targets and limits in diagnostics; stretching bones or large ankle translation to hide a broken rig is not a valid solution. Use support-normal alignment only on terrain supported by the chosen controller.

## Natural arms and fingers

First verify the native idle. An already natural source pose should be preserved. For a rest correction:

1. Resolve shoulders, upper/lower arms, wrists and each existing finger chain. Helper/twist bones may intervene. Missing middle/ring/little chains remain unsupported; whole-hand pose or a facial donor does not create them.
2. Establish each hand's longitudinal palm direction, radial direction and palm normal in a known rest pose. Derive radial direction from index/little metacarpals when available. With incomplete or nearly collinear landmarks, require author-provided axes rather than guessing. Test a tiny flexion independently on each side; mirrored local bone rolls often reverse signs.
3. Capture the complete fresh base pose of every written bone, including joints without clip tracks. Use small asset-calibrated wrist/elbow/rest-finger offsets to achieve palms toward thighs, relaxed finger curvature, separated silhouettes and neutral thumb opposition. Those visual goals can be adapted for the user's anatomy/style. The historical curl angles are not universal joint targets.
4. Apply an offset quaternion to that fresh base with a bounded weight. `composeLocalOffset` uses `base * weightedDelta` for explicitly **local** offsets. Convert world/anatomical frames beforehand and verify the chosen order. Reapplying to last frame's corrected quaternion causes drift.
5. Activate relaxation only for declared idle/walk/run states and channels. Gestures, props, aiming, climbing, captured hand poses and future tracking take precedence. Blend transitions according to the action; do not let a residual rest layer fight a hand opening to grab an object. A deliberate jump hand pose also owns its channels.

Check hand position relative to the torso in side view. Fix shoulder rest/reference mapping before pushing wrists forward. Avoid both hand/garment penetration and arms unnaturally spread away from the body. Preserve clavicle, elbow and twist behavior when retargeting. An arbitrary global shoulder lift is not a portable fix for dropped shoulders.

## Neck and face-body connection

Verify ear/head, shoulder and upper-torso landmarks in front/side views at identical animation times. A forward head can result from reference-pose mismatch; do not zero neck/head rotations during all animation.

For a separate facial rig, synchronize required torso/neck anchors before evaluating face/gaze. Compute target world transforms from the **current** body pose and stored calibration, then convert each through its current parent. Parent-first updates matter. A rigid head-group attachment can look correct while standing and expose a neck flap in a seated/bent/run pose. See reference09.

## Acceptance evidence

Declare contact tolerance in meters plus rig/foot scale. Capture both shoes at several idle phases, relevant sitting transitions, stance and swing samples, takeoff/flight/landing and reset. Include a translated/rotated character, two body sizes and different footwear when general reuse is claimed. These are target checks, not a demand to run every unsupported terrain mode.

Record heel/forefoot signed residuals and penetration, stance drift over time, correction limits, knee range/length preservation and airborne-release status. Static contact can pass while a gait or seated pose remains unverified. The accepted hybrid measured roughly1.106mm maximum static Stand residual; seated/transition samples reached roughly3.391mm. These are historical results for one asset and method, not tolerances or a promise for another character.

Inspect both hands at rest, walk/run, gesture, jump and action transitions at normal speed. Capture front/side close-ups with no reversed curl, extreme splay, finger intersections or hand/garment collision. Review shoulders and head/neck with the same poses. Synthetic kernel tests establish math behavior only; final anatomy needs actual geometry/render evidence.


<a id="resource-10"></a>

## Resource: references/09-customization-and-hybrid.md

# 09 — Custom identity and compatible expressive structure

## What stays common, what changes

Keep the reusable behavior/ownership interfaces: humanoid body animation, per-role native/retargeted clips, phase-aware shoe contact, calibrated hand/rest layers, semantic facial channels with emotion/blink/gaze composition, host-owned world/render lifecycle and diagnostics. Adapt appearance, proportions, facial sculpt, skin/hair/eyes, clothing, footwear and art style to the user's brief.

The common method does not require a particular face, male presentation, costume, 41/73 joints, 66 morph names, 5/9m/s movement, a specific animation vendor or an Al-Amr account. Bone names/counts and clip labels are data. Keep semantic role/channel mappings stable while allowing extra expressive channels and motion roles.

## Select a production route

| Input | Implementation |
|---|---|
| Complete desired character with compatible face and body rig | Use one native rig and preserve its topology/weights; calibrate mappings |
| Desired body/outfit and good native clips, but an inadequate face | Author a compatible expressive head on that rig, or mount a separately calibrated facial rig |
| Good expressive topology, different desired face | Sculpt neutral identity and all expression endpoints coherently; update dependent parts |
| Only sealed neutral facial mesh | Author eyelid/lip loops, mouth interior and real shape keys/face-bone deformation; surface matching alone is insufficient |
| No suitable geometry or authoring tool | Complete independent runtime/config work and report the actual missing geometry/rig task |

For a new character, a unified body/face rig is often simpler. A two-rig hybrid is useful when preserving an existing motion library outweighs its synchronization complexity; it is not mandatory.

## Preserve native motion and anatomy

Map `idle`, `walk`, `run`, `jump` and optional `gesture`, `sitDown`, `seated`, `standUp`, `flight` to actual asset sources. Keep authored tracks unchanged when the target rig is compatible. If only jump comes from another donor, retarget only that role. Other projects may choose a different donor or native jump; expose that decision in the profile.

Preserve full native endpoints and one-shot hold/loop semantics. A clip's name is not its motion meaning. Verify hand, elbow, knee, foot and shoulder trajectories in an anatomical reference frame. Choose per-clip calibrated movement speeds, not a historical prototype's tuning.

## Sculpt an expressive identity

Prefer topology with functional eyelids/lips, native eyes/teeth and existing expression deltas. Shape the requested face/hair/outfit without turning an arbitrary neutral face into an unsupported expression surface.

For relative morphs, if the original base point is `p`, delta is `d` and identity warp is `F`, use:

```text
newBase = F(p)
newDelta = F(p+d) - F(p)
```

For absolute morph targets, store `F(targetPoint)` instead. Convert base/endpoints into the same authoring frame before applying F and back into the intended local frame afterward. A nonlinear warp applied only to the base changes facial behavior even if target names remain. `warpRelativeMorphs` demonstrates the position calculation without skinning or normal handling.

For a smooth warp, normals use the appropriate inverse-transpose Jacobian of F, then normalize. Relative normal morphs describe endpoint normals relative to the new base normal. Recomputing normals per target can be an alternative when topology/rendering permits it; validate seams/tangents. Preserve lips/eyelids, teeth/jaw and lash alignment at extreme expressions. Apply coherent transforms to all affected parts and protect the neck attachment region.

Preserve identity/body-size/cloth-corrective channels not owned by the facial compositor. Calibrate gains and limits per avatar; missing channels are not replaced by empty shapes. The six emotions and manual controls must visibly deform the chosen face. Existing visemes do not implement speech generation or audio lip sync.

## Separate-head integration

Clone the complete required facial skeleton ancestry and private mutable geometry/materials. `SkeletonUtils.clone` retains shared geometry/material references; clone those separately before edits [S5]. Never assume a traversal name map can merge body and facial bones safely when both contain Head/Neck.

Keep body-role and face-role registries separate or explicitly namespace them. Capture body/facial anchor transforms and calibration in one known reference pose. For a calibrated anchor:

```text
calibration = inverse(bodyRestWorld) * facialRestWorld
desiredFacialWorld = bodyCurrentWorld * calibration
desiredFacialLocal = inverse(facialParentCurrentWorld) * desiredFacialWorld
```

This is a transform convention, not a universal local-bone quaternion assignment. Account for model normalization, parent scales, bind matrices and the rig's actual hierarchy. Update mapped ancestors parent-first. Only assign rigid TRS when representable; shear/nonuniform scale needs explicit conversion/baking. Do not modify inverse binds to hide an incorrect coordinate conversion.

Synchronize torso/neck influences as well as Head where the facial neck geometry is skinned to them. Verify that a global mount transformation is not applied a second time through those anchors. Update root/body animation, anchors, facial deformation and gaze in the documented order.

Fit the collar/neck using private masks or suitable authored geometry while preserving garment UVs/materials. Clone before index/attribute/material changes. An absolute horizontal head cut can remove a raised collar; anatomical classification or an author-defined seam is safer. Large masks, crossed planes and blanket alpha changes can hide valid clothes or expose an empty neck. Restore sources on disposal and verify both opaque and cutout material paths.

## Renderer and host independence

Keep core behavior independent of Al-Amr, DOM, a global singleton, input bindings, camera selection and any one physics engine. Integrate through profile/asset URLs, time, world pose/motion state and support queries. A standalone sandbox can own these; an existing host should retain ownership. Do not instantiate a second world controller/RAF loop beside one already supplied by the host.

Match renderer requirements to actual materials. The accepted hybrid's custom face/collar use TSL node materials and WebGPURenderer; copying that shader is not a promise of compatibility with legacy WebGLRenderer. A general skill can use standard glTF PBR on a tested renderer or author a separate compatible material adapter. Preserve artistic appearance and state the tested renderer/version/backend.

All runtime model, texture, motion and decoder resources should be local when offline use is requested. Copy the complete glTF dependency closure, not just its JSON file. The author's desktop shell is optional; a browser sandbox and another web host must be able to use the same avatar core without a mock `window.alamr` in production.

## Future hands, speech and XR

Reserve explicit owners/priorities for finger gestures/tracking and speech channels. Per-hand capability may be partial. Five-finger grasp requires actual articulated chains, suitable skinning, IK/reach and object-contact logic. Meta Quest/controller integration also requires the actual WebXR input/controller adapter, calibration and device tests. A future-facing type or existing facial viseme does not establish any of those capabilities.

## Validation across appearance choices

Use at least two materially different body/footwear calibrations in reusable math/adapter tests. For production reuse, render the actual requested characters; synthetic profile examples alone do not prove visual compatibility. Retest affected appearance after changing topology, clothes, proportions, bind pose or shaders. Keep historical accepted assets and reports as historical evidence, not inherited passes.


<a id="resource-11"></a>

## Resource: references/SOURCES.md

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

## Revision1.1.0 verification

S1, S2, S3 and S5 were opened and checked on22 October2026. In particular,
Mesh.getVertexPosition returns animated local-space positions, and
SkeletonUtils.clone preserves shared geometry/material references. Recheck
those APIs against the actual pinned Three version; current docs are not
proof of compatibility with the historical r180 example. S4/S6/S7 remain
primary reference links, without claiming they were newly verified here.

References08/09 and the kernel are engineering generalizations informed by
the project's accepted hybrid. Historical measurements are identified as
asset-specific. The original package is preserved separately; its validation
is under validation-v1.0.0 in the outer delivery, not a current result.

Skill installation/discovery varies by agent/runtime. Provide the complete
folder or the portable Markdown plus resources. Verify the target agent's
own documented discovery path; this package does not install itself, use an
account, migrate a GPT or claim an upcoming platform schedule.

## Limits on source interpretation

The glTF/Three.js docs establish available format/runtime mechanisms, not proof of a particular avatar's realism. This package's preset weights, animation tuning and quality gates are engineering/art direction choices. The current Three.js docs may describe features absent from the original r180 source; do not mix addon versions. The standalone package is not an officially registered plugin or automatically installed skill.


<a id="resource-12"></a>

## Resource: assets/avatar-profile.template.json

````json
{
  "schemaVersion": "1.1.0",
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
    "style": null
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
    "defaultEmotion": "neutral",
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
    "initialMode": "orbit",
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
    "Motion numbers reproduce prototype tuning; recalibrate for the actual rig.",
    "Contact/hand values are unresolved calibration, not a universal stance or finger pose.",
    "Map motion roles to actual native/retargeted/procedural sources; no donor is mandatory.",
    "Historical movement tuning is provisional and must be calibrated to actual clips and proportions."
  ],
  "contact": {
    "enabled": true,
    "supportProvider": null,
    "airbornePolicy": "release",
    "gapToleranceMeters": null,
    "penetrationToleranceMeters": null,
    "feet": {
      "left": {
        "samplingMode": "vertices",
        "mesh": null,
        "primitive": 0,
        "heelVertices": [],
        "forefootVertices": [],
        "heelMarker": null,
        "forefootMarker": null,
        "clearanceMeters": null,
        "maxPitchRadians": null,
        "maxVerticalCorrectionMeters": null
      },
      "right": {
        "samplingMode": "vertices",
        "mesh": null,
        "primitive": 0,
        "heelVertices": [],
        "forefootVertices": [],
        "heelMarker": null,
        "forefootMarker": null,
        "clearanceMeters": null,
        "maxPitchRadians": null,
        "maxVerticalCorrectionMeters": null
      }
    }
  },
  "posture": {
    "enabled": true,
    "referencePose": null,
    "bodyOffsets": [],
    "relaxStates": [
      "idle",
      "walk",
      "run"
    ],
    "preserveGestureAndTracking": true,
    "releaseRelaxationDuringAirborne": true,
    "requireFiveFingers": false,
    "hands": {
      "left": {
        "enabled": true,
        "palmFrame": null,
        "fingers": {},
        "jointOffsets": []
      },
      "right": {
        "enabled": true,
        "palmFrame": null,
        "fingers": {},
        "jointOffsets": []
      }
    }
  },
  "requiredMotionRoles": [
    "idle",
    "walk",
    "run",
    "jump"
  ],
  "motionRoles": {
    "idle": {
      "kind": "unresolved",
      "source": null,
      "clip": null,
      "loop": true
    },
    "walk": {
      "kind": "unresolved",
      "source": null,
      "clip": null,
      "loop": true
    },
    "run": {
      "kind": "unresolved",
      "source": null,
      "clip": null,
      "loop": true
    },
    "jump": {
      "kind": "unresolved",
      "source": null,
      "clip": null,
      "loop": false
    },
    "gesture": {
      "kind": "unsupported",
      "source": null,
      "clip": null,
      "loop": false
    },
    "sitDown": {
      "kind": "unsupported",
      "source": null,
      "clip": null,
      "loop": false
    },
    "seated": {
      "kind": "unsupported",
      "source": null,
      "clip": null,
      "loop": true
    },
    "standUp": {
      "kind": "unsupported",
      "source": null,
      "clip": null,
      "loop": false
    },
    "flight": {
      "kind": "unsupported",
      "source": null,
      "clip": null,
      "loop": true
    }
  }
}

````


<a id="resource-13"></a>

## Resource: assets/runtime-contract.d.ts

````typescript
/** DESIGN CONTRACT ONLY. The reference-project does not implement this factory yet.
 * Implement it in the new host and run lifecycle/independence tests before claiming support.
 * Three.js is a host peer dependency; match its pinned runtime/addon versions.
 */
import type { Object3D, Scene, Vector3 } from 'three';
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
  /** Optional borrowed renderer; avatar core never renders/disposes it.
   * Material adapter must document WebGL/WebGPU support separately. */
  renderer?: unknown;
  controlMode: 'host-pose' | 'standalone-controller';
  world?: CollisionAdapter; // required for standalone-controller; borrowed support adapter in host-pose
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
  contact: Record<string, { heelGapMeters: number | null; forefootGapMeters: number | null;
    maxPenetrationMeters: number | null; limited: boolean; active: boolean }>;
  handCapabilities: Record<string, { articulatedDigits: string[]; poseOwner: string }>;
  disposed: boolean;
}
export interface AvatarRuntime {
  readonly root: Object3D;
  /** Only for standalone-controller mode. Host-pose obtains input from its host. */
  setInput(input: MoveInput): void;
  /** Host calls once per display frame; runtime owns only its bounded fixed-step accumulator.
   * Do not also advance the same controller/mixer elsewhere in the host.
   */
  update(deltaSeconds: number, hostFrame?: {
    positionMeters: [number,number,number]; yawRadians: number;
    velocityMps: [number,number,number]; grounded: boolean;
    state: string; // host-pose consumes this; never advances another world controller
  }): void;
  previewMotion(role: string | null): void;
  /** Clears preview overrides before real movement/jump resumes. */
  resumeLocomotion(): void;
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

````


<a id="resource-14"></a>

## Resource: assets/facial-presets.json

````json
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

````


<a id="resource-15"></a>

## Resource: assets/runtime-kernel/README.md

# Calibration kernel

These authored ES modules have no dependencies on a particular character,
renderer, DOM, Al-Amr, network or Three.js installation. Import them directly
into a web project or Node. They do not generate geometry or implement IK.

- `fitSoleContacts(input)` proposes bounded pitch/height correction from two
  measured support patches in a calibrated sagittal frame. Pass explicit limits,
  pivot, grounded/stance state and optional weight. No ankle/bone is written.
  It does not solve roll/terrain continuity or infer support/landmarks.
- `clampLimbReach(distance, upperLength, lowerLength)` supplies a finite,
  scale-dependent target range. An actual leg solver still needs a knee pole.
- `composeLocalOffset(freshBase, localDelta, weight)` composes a normalized
  local offset from the **fresh** base quaternion. Quaternions use x,y,z,w.
- `warpRelativeMorphs(basePoints, targetDeltas, F)` transforms neutral positions
  and relative morph endpoints together. Normals/skin/bind/attachments remain
  the adapter's responsibility. F must be a deterministic point transform.

Example calibrated flat-support proposal:

```js
import { fitSoleContacts } from './calibration.mjs';
const fit = fitSoleContacts({
  heel: { along: 0, height: 0.012, supportHeight: 0 },
  forefoot: { along: 0.24, height: 0.002, supportHeight: 0 },
  pivot: { along: 0.06, height: 0.08 },
  maxPitchRadians: 0.15, maxShiftMeters: 0.02,
  grounded: true, stance: true, weight: 1,
});
// Values above are synthetic test data, not anatomical defaults.
// Convert fit.pitchRadians through this shoe's calibrated anatomical frame,
// apply once after base pose, remeasure actual skinned patches, report residuals.
```

Read references08/09 before applying the functions. Run the synthetic suite
from the skill root with `node --test tests/calibration.test.mjs`. A pass is
not a test of a user-selected GLB, footwear, renderer or visual realism.


<a id="resource-16"></a>

## Resource: assets/runtime-kernel/calibration.mjs

````javascript
/** Dependency-free calibration building blocks. No model loading, rig writes,
 * terrain query or renderer. Metres/radians; quaternions [x,y,z,w]. */
const finite = (v, name) => { if (!Number.isFinite(v)) throw new TypeError(name + ' must be finite'); return v; };
const bound = (v, min, max) => Math.max(min, Math.min(max, v));
const range = (v, min, max, name) => {
  finite(v, name); if (v < min || v > max) throw new RangeError(name + ' outside range'); return v;
};
const vec3 = (value, name) => {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(name + ' requires 3 coordinates');
  return value.map((v, i) => finite(v, name + '[' + i + ']'));
};

/** Two support patches in a per-foot sagittal (along, height) frame.
 * Positive pitch raises positive along. Ground samples are held fixed during
 * this approximation; a real terrain bridge must remeasure after applying it.
 * Each patch: {along,height,supportHeight,clearanceMeters?}. Pivot same frame.
 * Explicit bounds prevent a bad rig from being silently stretched into place.
 */
export function fitSoleContacts({ heel, forefoot, pivot, maxPitchRadians,
  maxShiftMeters, grounded, stance, override = false, weight = 1 }) {
  range(weight, 0, 1, 'weight');
  if (grounded !== true || stance !== true || override || weight === 0) {
    return { active: false, reason: 'released', pitchRadians: 0, shiftMeters: 0,
      limited: false, residuals: null };
  }
  range(maxPitchRadians, 0, Math.PI / 2, 'maxPitchRadians');
  if (finite(maxShiftMeters, 'maxShiftMeters') < 0) throw new RangeError('maxShiftMeters');
  const patches = [heel, forefoot].map((p, i) => {
    if (!p) throw new TypeError('Missing support patch ' + i);
    const clearance = p.clearanceMeters ?? 0;
    if (finite(clearance, 'clearanceMeters') < 0) throw new RangeError('clearanceMeters');
    const supportHeight = finite(p.supportHeight, 'supportHeight');
    return { along: finite(p.along, 'along'), height: finite(p.height, 'height'),
      supportHeight, target: supportHeight + clearance };
  });
  const px = finite(pivot?.along, 'pivot.along'), py = finite(pivot?.height, 'pivot.height');
  const [a, b] = patches, dx = b.along - a.along, dy = b.height - a.height;
  if (dx <= 0) throw new RangeError('Forefoot must be ahead of heel in calibrated along frame');
  const length = Math.hypot(dx, dy), groundDelta = b.target - a.target;
  const unreachable = Math.abs(groundDelta) > length;
  const desiredPitch = Math.asin(bound(groundDelta / length, -1, 1)) - Math.atan2(dy, dx);
  const boundedPitch = bound(desiredPitch, -maxPitchRadians, maxPitchRadians);
  const pitch = boundedPitch * weight;
  const rotatedHeight = p => py + (p.height - py) * Math.cos(pitch) + (p.along - px) * Math.sin(pitch);
  const desiredShift = patches.reduce((sum, p) => sum + p.target - rotatedHeight(p), 0) / patches.length;
  const boundedShift = bound(desiredShift, -maxShiftMeters, maxShiftMeters);
  const shift = boundedShift * weight;
  const residuals = patches.map(p => rotatedHeight(p) + shift - p.target);
  return { active: true, reason: 'two-patch-sagittal-fit', pitchRadians: pitch,
    shiftMeters: shift, limited: unreachable || Math.abs(desiredPitch - boundedPitch) > 1e-10
      || Math.abs(desiredShift - boundedShift) > 1e-10,
    unreachableSupportDelta: unreachable,
    residuals: { heel: residuals[0], forefoot: residuals[1],
      maxAbs: Math.max(...residuals.map(Math.abs)),
      maxClearanceDeficit: Math.max(0, ...residuals.map(v => -v)),
      maxPenetration: Math.max(0, ...patches.map(p => p.supportHeight - rotatedHeight(p) - shift)) } };
}

/** Scale-relative reachable distance for a two-bone chain; not an IK solver. */
export function clampLimbReach(distance, upperLength, lowerLength, epsilonRatio = 1e-6) {
  if (finite(distance, 'distance') < 0) throw new RangeError('distance');
  if (finite(upperLength, 'upperLength') <= 0 || finite(lowerLength, 'lowerLength') <= 0) throw new RangeError('Bone length');
  range(epsilonRatio, Number.EPSILON, 0.1, 'epsilonRatio');
  const epsilon = (upperLength + lowerLength) * epsilonRatio;
  const min = Math.abs(upperLength - lowerLength) + epsilon;
  const max = upperLength + lowerLength - epsilon;
  if (min >= max) throw new RangeError('Degenerate chain at this epsilon');
  const value = bound(distance, min, max);
  return { distance: value, min, max, limited: Math.abs(value - distance) > epsilon * 1e-3 };
}

function quaternion(value) {
  if (!Array.isArray(value) || value.length !== 4) throw new TypeError('Quaternion requires 4 coordinates');
  const q = value.map(v => finite(v, 'quaternion'));
  const length = Math.hypot(...q);
  if (length < 1e-12) throw new RangeError('Zero quaternion');
  return q.map(v => v / length);
}
function multiply(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz];
}

/** q = freshBase * slerp(identity, calibratedLocalDelta, weight).
 * Caller owns frame conversion/limits and must supply the uncorrected base
 * every frame. The same input remains stable; feeding the output back drifts.
 */
export function composeLocalOffset(freshBase, localDelta, weight) {
  range(weight, 0, 1, 'weight');
  const base = quaternion(freshBase); let q = quaternion(localDelta);
  if (q[3] < 0) q = q.map(v => -v);
  const angle = Math.acos(bound(q[3], -1, 1));
  const sine = Math.sin(angle);
  const weighted = sine < 1e-9
    ? quaternion([q[0] * weight, q[1] * weight, q[2] * weight, 1 + (q[3] - 1) * weight])
    : [q[0] * Math.sin(angle * weight) / sine, q[1] * Math.sin(angle * weight) / sine,
      q[2] * Math.sin(angle * weight) / sine, Math.cos(angle * weight)];
  return quaternion(multiply(base, weighted));
}

/** Apply a point warp to relative morph endpoints consistently. Arrays contain
 * one point/delta per vertex. This does not transform normals, binds or other
 * meshes; the authoring adapter must do that work separately. Inputs unchanged.
 */
export function warpRelativeMorphs(base, targets, warp) {
  if (!Array.isArray(base) || !Array.isArray(targets) || typeof warp !== 'function') throw new TypeError('Invalid morph input');
  const original = base.map((p, i) => vec3(p, 'base' + i));
  const shaped = original.map(p => vec3(warp([...p]), 'warpedBase'));
  const deltas = targets.map(target => {
    if (!Array.isArray(target) || target.length !== original.length) throw new RangeError('Morph vertex count mismatch');
    return target.map((delta, index) => {
      const d = vec3(delta, 'delta'), p = original[index];
      const endpoint = vec3(warp(p.map((v, i) => v + d[i])), 'warpedEndpoint');
      return endpoint.map((v, i) => v - shaped[index][i]);
    });
  });
  return { base: shaped, targets: deltas };
}

````
