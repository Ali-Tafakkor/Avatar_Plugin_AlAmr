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
