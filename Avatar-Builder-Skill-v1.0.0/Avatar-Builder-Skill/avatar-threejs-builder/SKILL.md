---
name: avatar-threejs-builder
description: Build, adapt, or integrate a reusable Three.js full-body humanoid avatar with skeletal locomotion, facial morph expressions, camera controls, and evidence-based testing. Use for controllable 3D web avatars, rigged GLB characters, walk/run/jump, and expressive faces. Separate appearance from runtime. Not for static portrait images, talking-head video generation, or non-humanoid rigs without a new adapter.
metadata:
  version: "1.0.0"
  language: "en"
  provenance: "Avatar Motion Lab source-derived workflow with explicitly identified portability improvements"
---

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
