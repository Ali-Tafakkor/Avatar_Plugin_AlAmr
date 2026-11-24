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

For a new identity, first follow the geometry review in [reference10](10-reference-likeness-and-clothes.md): neutral clay multi-view captures, reference feature comparison and editable geometry provenance. Check this separately from textured/styled likeness and dynamic facial behavior. Renaming, recoloring, remeshing or changing a hash cannot establish independent anatomy.

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
