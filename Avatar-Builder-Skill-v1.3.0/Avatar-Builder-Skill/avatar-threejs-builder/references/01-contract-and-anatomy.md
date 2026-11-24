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
