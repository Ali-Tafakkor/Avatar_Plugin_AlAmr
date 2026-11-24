# 02 — Asset selection, creation, and export

## What was actually done before

The reference project loads an existing full-body AvatarSDK example from TalkingHead. Its face, body mesh, skinning and textures were not sculpted in that project. Idle/walk/run were extracted from the Three.js Xbot example and adapted in code. The application adds procedural movement, facial weights, camera, test world and UI.

That is a historical integration example. For a new reference-based identity, follow [fresh head construction](10-reference-likeness-and-clothes.md): reference analysis → neutral geometry → likeness comparison → topology and facial rig → materials → runtime. The old sample is not a facial starting asset. A workflow description alone does not generate a photorealistic human.

## Route selection

| Available input | Correct route |
|---|---|
| User explicitly supplies the finished target character for integration/repair | Preserve its identity and usable rig within scope; build the adapter and calibrate |
| Motion donor or rigged body for a new identity | Match body proportions and garment cut to references, rebind/retarget as needed; construct and rig a fresh head |
| Static model with suitable human topology | Rig, skin and author expressions in a capable DCC tool before runtime integration |
| Photos or descriptive brief for a new character | Build new head anatomy from non-facial primitives/empty space; no inherited face template. Images are references, not geometry |
| Ready model but ambiguous/missing rights | Continue technical audit; block commercial release until resolved |
| No 3D authoring tools | Implement reusable runtime and validation; identify the missing model/rig work explicitly |

Use Blender or another available digital-content-creation tool only when it is actually installed or accessible. Do not invent exports, available plugins, current vendor plans, asset-generation capabilities or service responses. Verify current external services and terms before relying on them.

## DCC authoring checklist (new work, not historical evidence)

For new identities, establish and compare the neutral head before rigging. Topology, UVs, pivots and deformers below belong to that newly constructed anatomy. A stock face with new textures or a preserved donor atlas is not a valid substitute. Existing-character repairs keep their requested scope.

**Body and garment structure.** Follow [reference13](13-body-and-garment-shape.md) to model the observed regional fullness/slenderness, proportions and garment cut. Separate body mass from cloth ease; global scaling or a recolor cannot substitute for these changes. Establish a neutral pose and fit/rebind joints to the resulting anatomy. Preserve the main garment shell, but paint collar/lapel details, buttons and similar small features into texture rather than modeling them.

**Deformation topology.** Place edge flow around eyelids and lips so they can close without gaps; provide sufficient deformation support around shoulders, elbows, hips and knees. The exact topology is an artistic/rigging decision. Store a clean neutral face. Do not reorder vertices after authoring shape-key deltas unless they are regenerated consistently.

**Skinning.** Bind a humanoid skeleton and assign vertex influences. Test extreme joint poses, twisting and shoulder lift. Inspect normalized weight sums, valid joint indices, inverse bind matrices and unintended disconnected vertices with appropriate authoring tools. A metadata audit does not test these numeric values.

**Face.** Create independent bilateral shapes where the geometry supports them: smile/frown, brow lowering, brow raising, blink, widening, squint, cheek movement, jaw opening, lip shaping and optional nose sneer. Keep a true neutral separate from the default gentle smile. Do not copy a target name onto identical geometry and count it as a new expression.

**Eyes and mouth.** Place eyeballs so lids follow the surface; close blinks fully without swallowing the eyeball. Assign upper/lower teeth and tongue correctly. Decide whether jaw opening is a morph, a bone rotation or a coordinated hybrid and prevent it from being applied twice.

**Materials.** Use an appropriate skin color texture, roughness and normal detail; keep color data separate from linear parameter data. Preserve identity across light changes. Hair/eyelash transparency needs explicit sorting/alpha choices and tests. Face texture sharpness must be evaluated at final portrait framing, not the texture file dimensions alone.

**Animations.** Prefer clips authored for the rig when available. Otherwise retain the target skeleton and adapt licensed source clips. Capture/export a reliable reference pose. Keep looping locomotion separate from nonlooping takeoff/landing.

**Export.** Export binary glTF 2.0 with skins, vertex weights, facial targets and required animations intact. Reimport the exported file independently and compare the reference pose, one bent limb, a blink, open jaw and smile. Export support and UI vary by DCC version; verify the tool's current official instructions. glTF can carry skins and morph targets [S1]; do not assume every exporter option preserves them automatically.

## Runtime audit

Run the provided `inspect_glb.py`; use the official glTF Validator and an actual Three.js render for stronger validation. The bundled tool reports metadata, selected semantic mappings, referenced files, morph availability and decoder requirements. It does not download, render, decode textures or rewrite a GLB.

A strict metadata failure is not always a broken asset. For example, a bone-only facial rig can be valid but is unsupported by the named-morph inspector; unnamed morph indices require an explicit runtime adapter. Label the distinction clearly.

## Provenance and rights

Fill the manifest per asset: local path, source URI, version/commit, SHA-256, byte count, author, stated license/terms reference, intended use and review status. Hash actual bytes; never make up a hash. License status is recorded by a human/agent review, not established by a checksum or this script.

The original AvatarSDK sample is described upstream as non-commercial. Its code-hosting repository's license does not grant blanket commercial rights to all sample models. The Xbot motion is also third-party source material; extracting only tracks does not erase its rights. Preserve the original notices under `assets/reference-project/THIRD_PARTY_NOTICES.md`; replace restricted assets when the use requires it.

Do not embed personal photos in a distributable skill, upload them to an external authoring provider without authorization, or commit a user's private likeness to a public repository automatically.

## Reproducible installation

Pin engine/addon/decoder versions together. Include local texture and decoder files needed by the selected asset; a GLB may still refer to external resources. GLTFLoader requires the relevant decoder/texture loader for supported compressed assets [S4]. The reference r180 pin is a reproduction detail, not a claim that it is today's latest or mandatory for every host.

Prefer local project assets. If downloads are necessary, use approved HTTPS sources, hashes where available, limits, atomic writes, retry/error messages and resumable cache behavior. Keep TLS verification enabled. Validate cached files too. Do not execute arbitrary downloaded scripts. Only describe the bundle as fully offline after an offline run with no unapproved external requests succeeds.
