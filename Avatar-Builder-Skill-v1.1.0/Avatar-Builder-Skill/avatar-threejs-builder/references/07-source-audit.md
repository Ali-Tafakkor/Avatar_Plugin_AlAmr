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
