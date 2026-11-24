# 11 — Carry the production behaviors to another character

The Young Purple Avatar (AvatarHybrid 0.1.3) used a 41-bone body, 66 face channels and two mounted five-finger hands. Its newer hand geometry, calm idle, head mounting, face materials, self-contact guard and collar fit are applied by the runtime. Port the mechanisms below to the new asset and calibrate its geometry. Use [rig and axes](01-contract-and-anatomy.md), [motion roles](03-body-animation.md), [facial composition](04-face-animation.md) and [contact calibration](08-contact-and-posture.md) for their specific contracts.

## Body, neck and gaze

- Bind idle, walk, run, reverse travel, jump and landing to actual motions. Bind gesture, seated transitions and flight when requested for parity in the host. Identify loop/one-shot/hold and exit behavior. Preserve compatible native motion and retarget only the required roles. Reset grounding, pending transitions and additive offsets on teleport or clip-inspection exit. Keep one writer for world pose.
- Build quiet standing from the calibrated neutral stand pose. Use a smooth periodic breathing channel on the torso and a small smooth horizontal look cycle on the neck/head. Compensate inherited scale and displacement at the neck anchor when breathing would resize or bob the face. Check smooth loop endpoints, natural side view, eyes, clavicles and feet. Keep the animated head/neck behavior of other clips. The reference timing and amplitudes are calibration examples for one character.
- Define neck/head/eye rest frames in model space, explicit yaw/pitch/roll limits and the weight each joint owns. Convert the gaze target through current world and parent frames. Distribute bounded gaze over eyes, head and neck, blend acquisition/release and return smoothly to neutral. Update a separate head's torso/neck/head anchors parent-first after the current body pose. Take the first-person eye position from the resulting live pose. Check camera offsets in standing, crouch/sit and turn.
- Calibrate a relaxed default face for the chosen identity. Bind neutral, smile, laugh, sadness, anger and surprise, with intensity and per-channel controls. Preserve blink closure during surprise and gaze while emoting. Keep teeth, eyes and lashes aligned under combined head motion and face deformation. Make the compositor the sole writer of owned face channels.

## Five-finger hands and clothing

1. Prefer an existing correctly skinned full hand. Otherwise use an authorized donor with its own palm and finger skin, or rig a new hand with a thumb and four separate flexion chains. Audit both hands. Calibrate each from wrist, index and thumb landmarks and correct mirrored handedness, palm twist, flexion axes and units. Match hand size to the character and align the cuff at neutral and at motion extremes.
2. When replacing hands, clone mutable resources, mount each hand at its calibrated wrist transform, remove only redundant old skin, and preserve the cuff and sleeve. Derive the exclusion mask from the new mesh and weights. Match skin color under the same host lighting as the face. Verify all five digits deform the visible surface, including the thumb opposing the index. Provide per-hand natural/rest, open, fist, point and pinch, plus individual curl controls if parity is requested. Declare input precedence for tracked hands, authored gestures, poses and manual inspection.
3. Keep standalone garment fit independent of neck contour. For a small existing gap, use a smooth bounded local warp on the garment in its calibrated frame. Preserve already-correct front edges, UV seams, weights and surface normals. Check that coincident seam vertices receive the same spatial deformation. If the model uses a skin/cloth atlas, retain the intended neckline exclusion in the replacement material. For a different garment cut or a large overlap, author/re-skin the garment instead of closing the gap with color or a cover strip. Inspect front, profile and rear in stand, turn, walk and sit.

## Post-animation hand clearance and seated support

1. Fit bounded convex regions or other appropriate proxies to the character's own deformed body and outfit in a reference pose. Attach them to their owning bones in bone-local frames and refresh from the current pose. Include likely contact regions such as torso, legs, head or opposite arm. Exclude the hand's own intentional cuff junction. Sample the skinned palm, thumb and fingertips, preserving coverage per digit.
2. Measure signed penetration in a common frame. Use the [portable contact math](../assets/runtime-kernel/README.md) for convex plane fitting, sampled penetration and a bounded pivot correction. Transform points and normals through the actual instance hierarchy. Apply a limited rotation about a suitable arm joint onto that frame's uncorrected pose. Re-sample after correction, smooth release once clear and reset on clip/authority transitions. Verify with independent samples against visible deformed surfaces. This local guard handles hand–body clearance. World collision and grasping use separate host/prop logic.
3. For a seated host, fit seat depth/height, pelvis, foot support and thigh/table contact to the actual chair, avatar and clothes. Preserve segment lengths and use reach/pole constraints. Test palm and fingertip support against visible surfaces. Reserve intentional contact for the seated pose solver and recheck that its final pose does not reintroduce unrelated collisions. Verify sit approach, sit, hold, stand, chair swivel if offered, and occlusion from first and third person. The host owns seat reservation, collision with furniture and navigation.

Use this frame order as a starting point: restore owned offsets → host world transform and base motion → posture/neck/eye targets and foot support → update attachments and finger pose → hand–body guard → intentional seat/prop support → refresh final anchors, compose facial channels, update diagnostics. Place each stage before the systems that read its output. Head synchronization and material preparation have their own dependencies. Keep two instances independent and dispose private geometry/materials.

## Evidence and source map

Inspect hand poses individually and in moving clips, measure bounded correction and remaining clearance, verify shoe support and airborne release, and compare neck/collar behavior across all relevant poses. Use the [test report](../assets/TEST-REPORT.template.md) on the actual target asset in the requested renderer. For performance-sensitive hosts, profile repeated frames and independent avatars. Cache shared bone transforms per mesh/pose during skin sampling, and check the optimized samples against normal skinning.

If the original project is available, inspect these paths there for exact working examples:

| Mechanism | Reference project source |
|---|---|
| Frame ownership, compatible facade and body motion | `آواتار/src/hybrid/runtime.mjs`, `body-runtime.mjs` in the same directory |
| Quiet stand, neck contours and mounted face | `آواتار/src/hybrid/quiet-idle.mjs`, `head-mount.mjs`, `neck-collar.mjs` |
| Five fingers, skin replacement and clearance | `آواتار/src/hybrid/detailed-hands.mjs`, `hand-skin-mask.mjs`, `hand-contact.mjs` |
| Cloth neckline and skin/eye/cloth materials | `آواتار/src/hybrid/garment-neckline.mjs`, `surface-materials.mjs` |
| Inspection and resource metrics | `avatar-lab/src/App.tsx`, `performance-metrics.mjs` |
| Meeting room's WebGL/XR port, support and skin sampling | `MettingRoom_Published/src/vendor/avatar-hybrid-0.1.3/HOST_PORT.md`, `src/seating-fit.ts`, `src/meeting-avatar.ts` in that environment |

The instructions and calibration helpers in this package work without that checkout. Original masks, face texture, GLSL/TSL implementation and measured constants belong to the original model/host. Implement and test your backend explicitly. WebGPU materials, browser WebGL and a physical XR device have different verification requirements.
