# 13 — Reference-derived body and garment structure

Use for every new full-body character, and for requested body/outfit changes. Keep the fresh facial construction rules in reference10. Body proportions and garment cut must come from the current references and explicit choices, not the Purple Avatar's default body or shirt/trousers. Reusable animation is not a reason to retain an incorrect silhouette.

## Read body shape separately from garment fit

Record reference view, pose, perspective and the visible evidence for stature ratios, head-to-body ratio, shoulder breadth/slope, torso length/depth, chest, waist, abdomen projection, pelvis/hips, upper-arm/forearm fullness, thigh/calf fullness and limb lengths. Represent visible slenderness, fullness and mass distribution in geometry. Do not infer exact kilograms, BMI, health or unseen anatomy from appearance. Without a scale reference, use relative proportions rather than invented height measurements.

Separate body volume from cloth ease: a wide coat is not proof of a wide waist, and a loose sleeve is not an arm measurement. Record which contours are visible body, garment surface or uncertain. Use side views for depth and front views for breadth with perspective corrections; do not treat shadow edges as silhouette. If only a headshot exists, ask for a body reference or a preferred build; if views remain unavailable, record delegated/interpreted proportions and uncertainties. Do not silently fall back to a standard slim body.

## Build the actual body volumes

Model or substantially reshape the body to the supported proportions, with region-specific widths, depths, lengths and transitions. A global scale or a single uniform fat/thin multiplier is insufficient when the reference distributes volume differently across belly, hips, limbs and shoulders. Compatible topology/rig concepts can be reused as authoring aids, but the resulting geometry must match the requested build. Save editable sources and record which regions changed. Do not preserve donor dimensions merely to keep its animation clips unchanged.

Inspect an undecorated neutral body or simple opaque fitted proxy from front, side and three-quarter views. Use rear evidence when provided. Compare the proportional and volume map to the references, marking covered areas as uncertain rather than pretending their shape was measured. Keep the neutral head/body ratio consistent. Avoid detailed hidden anatomy that contributes neither to garment fit nor deformation.

Place joints for the new segment lengths and widths, update rest/bind transforms coherently, re-skin or regenerate affected weights/correctives, and retarget motions as necessary. Runtime rules about preserving segment lengths apply after authoring the target rig; they do not freeze donor dimensions during modeling. Update head/neck mounts, hand size/wrist alignment, leg reach, shoe support, body-contact proxies, seat fit and collision clearance. A wider abdomen/thigh cannot be handled by reusing a slim avatar's contact limits.

## Model garment structure; paint small details

First identify the actual garment types, layers, lengths, fit and silhouette in the designated reference. Model the main shell accordingly: torso coverage and bulk; shoulder/sleeve shape and length; coat/skirt/robe hem; trouser rise, width, taper and length; exposed skin boundaries and footwear outline. Preserve overall drape and major volume that affects silhouette. Do not turn every outfit into the same shirt/trousers with new colors, or paint a long coat onto a short shirt mesh. Recoloring is sufficient only for an explicitly color-only change to the same accepted cut.

Use texture for nonessential details: collar/lapel outlines and folds, buttons, buttonholes, placket lines, stitching, zipper teeth, decorative pocket lines and small trim. Do not create separate collar bands/flaps, button spheres/discs, tiny trim meshes or displacement geometry for those details. Paint/bake them into the actual garment UVs, with roughness and subtle normal/bump detail if useful. This simplification deliberately removes their protruding shape; do not reintroduce geometry merely because a collar is visible in close-up.

Keep the garment's basic neck opening and neck/skin boundary correctly fitted so there is no hole or floating edge; that necessary structural boundary is distinct from a modeled decorative collar. Major reference-defining structures such as a hood, long coat, bulky outer layer or wide skirt still require their main volume. Small details on them remain textures. An explicit later request for modeled hardware may change this scope; do not assume it.

Author/refit the garment on the new body, with appropriate ease and simple deformation support. Create/rebake UVs as needed; an old atlas cannot dictate the new cut. Sample texture markings in the garment's own surface coordinates, verify seams and sufficient texel density at the intended distance, and avoid baked photographic highlights. Decorative marks should deform with the garment without floating geometry or added collision meshes.

## Acceptance on the delivered asset

Before surface polish, capture full-body plain-material front/profile/three-quarter views and compare body proportions and garment silhouette separately. Record per-region geometry decisions with reference evidence and uncertainty, then repeat the views with final textures. Reject a recolored stock body/outfit when its proportions or cut disagree with the reference. Inspect a wireframe/mesh inventory to confirm that collars, buttons and similar details are represented in maps rather than hidden duplicate geometry; a lower triangle count alone is not proof.

Test shoulder/arm motion, walk/run, bend, seated poses and transitions as in scope. Check abdomen/thigh/sleeve clearance, hand-body contact, neck opening, hem/leg interference, skin/cloth separation, shoe grounding and texture stability. State actual likeness, garment simplification and deformation outcomes separately. Numerical package tests do not validate the newly shaped character; do not claim completion when authoring or visual evidence is unavailable.
