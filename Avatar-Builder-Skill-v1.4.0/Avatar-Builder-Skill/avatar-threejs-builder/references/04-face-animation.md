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

Neutral and gentle smile must be independently selectable. The historical demo starts smiling; the generalized template starts neutral for inspection unless requested otherwise. Laughing jaw movement does not imply audio, speech synthesis or lip sync. For a new identity, construct the neutral head and author its own facial deformers using [reference10](10-reference-likeness-and-clothes.md), then use [reference09](09-customization-and-hybrid.md) for assembly and live neck/torso synchronization. Preserve the resulting topology once deformers exist. Endpoint warping is a limited-edit technique for that identity, not a way to inherit another face.

## Channel coverage

Essential morph-mode controls for the requested face include bilateral blink, smile, frown, brow down, outer brow up and eye wide, plus inner brow up and jaw open. Check **both sides**; the source's compact warning list is not enough. Cheek squint, eye squint, nose sneer, lip shaping and detailed jaw controls improve the presets. Gaze may use eye bones or eye-look morphs, but not two uncompensated methods simultaneously.

There is no required magic total such as exactly 52 shapes. An avatar with fewer meaningful controls can support the requested expressions; an avatar with hundreds of unrelated/empty shapes may not. Report per-expression coverage, not just total morph count. Absent optional channels should reduce/degrade the associated feature visibly and be logged. Missing core channels block a claim of fully supported expressions.

## Adapter binding

Author each bound shape or bone deformer on the new neutral anatomy. Reuse semantic names and composition logic, not donor delta arrays, fixed vertex masks or donor eye/jaw pivots. Calibrate amplitudes and correctives from the new face; shared preset numbers alone do not preserve behavior. Verify return to its own neutral identity after emotion and speech.

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
