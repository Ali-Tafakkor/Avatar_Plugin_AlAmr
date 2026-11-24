# 09 — Custom identity and compatible expressive structure

## What stays common, what changes

Keep the reusable behavior/ownership interfaces: humanoid body animation, per-role native/retargeted clips, phase-aware shoe contact, calibrated hand/rest layers, semantic facial channels with emotion/blink/gaze composition, host-owned world/render lifecycle and diagnostics. Adapt appearance, proportions, facial sculpt, skin/hair/eyes, clothing, footwear and art style to the user's brief.

The common method does not require a particular face, male presentation, costume, 41/73 joints, 66 morph names, 5/9m/s movement, a specific animation vendor or an Al-Amr account. Bone names/counts and clip labels are data. Keep semantic role/channel mappings stable while allowing extra expressive channels and motion roles.

## Select a production route

| Input | Implementation |
|---|---|
| Explicitly supplied finished target character for integration/repair | Use one native rig and preserve its topology/weights; calibrate mappings |
| Desired body/outfit and good native clips, but a new desired face | Construct a fresh head from references, rig it and calibrate its body attachment |
| New reference identity, even if an expressive donor is available | Build fresh neutral facial geometry and its own topology/deformers; reuse behavioral interfaces only |
| Only sealed neutral facial mesh | Author eyelid/lip loops, mouth interior and real shape keys/face-bone deformation; surface matching alone is insufficient |
| No suitable geometry or authoring tool | Complete independent runtime/config work and report the actual missing geometry/rig task |

For body/clothing work, [reference13](13-body-and-garment-shape.md) governs regional body proportions, garment cut, texture-only small details and rig refitting. A motion donor does not impose its body dimensions or outfit.

For a new character, a unified body/face rig is often simpler. A two-rig hybrid is useful when preserving an existing motion library outweighs its synchronization complexity; it is not mandatory.

## Preserve native motion and anatomy

Map `idle`, `walk`, `run`, `jump` and optional `gesture`, `sitDown`, `seated`, `standUp`, `flight` to actual asset sources. Keep authored tracks unchanged when the target rig is compatible. If only jump comes from another donor, retarget only that role. Other projects may choose a different donor or native jump; expose that decision in the profile.

Preserve full native endpoints and one-shot hold/loop semantics. A clip's name is not its motion meaning. Verify hand, elbow, knee, foot and shoulder trajectories in an anatomical reference frame. Choose per-clip calibrated movement speeds, not a historical prototype's tuning.

## New identity: geometry first, behavior second

Follow [reference-driven construction](10-reference-likeness-and-clothes.md). Independently author the neutral face, retopologize that sculpt, fit eyes/lids/teeth, and build real face deformers. Reuse the compositor and canonical channel meanings, with new mappings and calibrated gains. Do not copy donor deltas, facial landmark masks or UV constraints onto a new identity. Rebuild neck/head/eye anchors from the new anatomy. Neither the number of shapes nor a successful adapter proves likeness.

## Limited edits to an already authored identity

The math below applies only after the target face has been established, or to a requested repair of the same accepted character. It preserves coherence during bounded edits; it is not the new-identity construction route. If changed topology invalidates correspondence, regenerate deformers and rebind dependents instead of applying this formula to unrelated vertices.

For relative morphs, if the original base point is `p`, delta is `d` and identity warp is `F`, use:

```text
newBase = F(p)
newDelta = F(p+d) - F(p)
```

For absolute morph targets, store `F(targetPoint)` instead. Convert base/endpoints into the same authoring frame before applying F and back into the intended local frame afterward. A nonlinear warp applied only to the base changes facial behavior even if target names remain. `warpRelativeMorphs` demonstrates the position calculation without skinning or normal handling.

For a smooth warp, normals use the appropriate inverse-transpose Jacobian of F, then normalize. Relative normal morphs describe endpoint normals relative to the new base normal. Recomputing normals per target can be an alternative when topology/rendering permits it; validate seams/tangents. Preserve lips/eyelids, teeth/jaw and lash alignment at extreme expressions. Apply coherent transforms to all affected parts and protect the neck attachment region.

Preserve identity/body-size/cloth-corrective channels not owned by the facial compositor. Calibrate gains and limits per avatar; missing channels are not replaced by empty shapes. The six emotions and manual controls must visibly deform the chosen face. Existing visemes do not implement speech generation or audio lip sync.

## Separate-head integration

Integrate the newly authored facial skeleton and private geometry/materials. When instancing an existing accepted target, clone its complete required facial skeleton ancestry and private mutable geometry/materials. `SkeletonUtils.clone` retains shared geometry/material references; clone those separately before edits [S5]. Never assume a traversal name map can merge body and facial bones safely when both contain Head/Neck.

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

## Hands, speech and XR

Use the [production rig guide](11-full-body-production.md) for articulated hands, hand–body clearance and seated support. Reserve explicit ownership for finger gestures and tracking. Physical object grasp adds reach, contact and prop ownership. [Microphone lip sync](12-optional-speech.md) adds a separate optional input path. Meta Quest/controller support requires the WebXR adapter, calibration and device tests.

## Validation across appearance choices

Use at least two materially different body/footwear calibrations in reusable math/adapter tests. For production reuse, render the actual requested characters; synthetic profile examples alone do not prove visual compatibility. Retest affected appearance after changing topology, clothes, proportions, bind pose or shaders. Keep historical accepted assets and reports as historical evidence, not inherited passes.
