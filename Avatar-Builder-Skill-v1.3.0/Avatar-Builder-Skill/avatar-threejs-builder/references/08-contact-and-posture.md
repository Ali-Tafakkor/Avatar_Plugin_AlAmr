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
