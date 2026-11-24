---
name: avatar-threejs-builder
description: "Build or repair full-body Three.js avatars from an appearance brief, reference photos or a 3D asset. Use for custom likeness and clothing, expressive faces, head/neck motion, articulated hands, retargeted animation and calibrated body contact in web hosts."
metadata:
  version: "1.3.0"
  language: "en"
  provenance: "Historical Motion Lab snapshot and production guidance from AvatarHybrid 0.1.3 and its meeting-room host"
---

# Customizable Web Avatar Builder

Build the user's character and a reusable web runtime. When asked for the capabilities of the Young Purple Avatar, carry over the behaviors and recalibrate them for the new character: locomotion and transitions, quiet standing, independent head/neck and eye motion, expressive face, articulated fingers, hand–body clearance and grounded footwear. Identity, clothes, proportions, style and host come from the new brief. The reference's measurements, fixed vertex masks and renderer code are specific to its assets.

This skill is an engineering/authoring workflow, not a text-to-3D model or a prebuilt avatar factory. Appearance text needs an actual selected or authored asset. Never present a portrait image, parameter file or static mesh as a completed expressive rig.

## Choose the task mode

**Choose task mode first.** For a new character from references, construct a fresh neutral head from those references before facial rigging. Start from empty space or non-facial primitives. Derive skull, jaw, cheeks, orbits, nose, lips, chin and ears from the requested person. Do not use the Purple Avatar, another finished head, stock human face or parametric identity template as the facial foundation. A cloned/remeshed donor or small identity warp remains an inherited face; changes to age, skin, hair, beard or clothes do not satisfy this requirement.

Reuse behavior code, semantic controls, timing and compatible body/hand motion. Author the new head's topology, facial deformers, mouth interior, eye fit, UVs and skin weights for its own anatomy. Old vertex counts, masks, UV islands, landmark positions and morph deltas are not constraints. Preserve topology only after establishing this new neutral face and authoring its deformers. General anatomical edge-flow principles describe how to build, not a preset shape.

Read reference10 before choosing assets for a new identity. Inspect neutral geometry without skin textures, hair, beard or glasses in front/profile/three-quarter views before surface polish. Then build and calibrate expressions and requested speech on that head. If authoring access is missing, report the missing work; do not silently substitute the old head.

An explicitly requested repair of an existing character or integration of a user-supplied finished target head preserves that identity within scope. A generic motion donor is not a finished target likeness. This mode distinction governs all older examples and preservation guidance below.

## Select the relevant references

Read the user's brief and host conventions. Load only the needed references:

| Work | Read |
|---|---|
| Structure, coordinate conventions, semantic mapping | [01-contract-and-anatomy.md](references/01-contract-and-anatomy.md) |
| Choose/create an identity, clothing, export and asset rights | [02-assets-and-authoring.md](references/02-assets-and-authoring.md) |
| Native clips, retargeting, state/phase and jump | [03-body-animation.md](references/03-body-animation.md) |
| Six emotions, blink/gaze, per-mesh channels and ownership | [04-face-animation.md](references/04-face-animation.md) |
| Renderer, camera, host and lifecycle | [05-camera-rendering-integration.md](references/05-camera-rendering-integration.md) |
| Tests, measurements and delivery | [06-validation-and-delivery.md](references/06-validation-and-delivery.md) |
| Inspecting historical runtime mechanics, not a new-character facial base | [07-source-audit.md](references/07-source-audit.md) |
| Full-body build, heel/toe contact, hands, shoulders or neck defects | [08-contact-and-posture.md](references/08-contact-and-posture.md) |
| Identity sculpting or combining a body and a facial rig | [09-customization-and-hybrid.md](references/09-customization-and-hybrid.md) |
| Reference photos, likeness, clothing brief and authoring checks | [10-reference-likeness-and-clothes.md](references/10-reference-likeness-and-clothes.md) |
| Young Purple Avatar feature parity, full hand rig, neck, collar, quiet idle, body contact and seated fit | [11-full-body-production.md](references/11-full-body-production.md) |
| Optional microphone lip sync and audible laughter | [12-optional-speech.md](references/12-optional-speech.md) |
| Hair/clothing repairs and wrist/host checks; inherited-head method is superseded | Olive Man case study for [appearance and clothing](references/olive-man/appearance.md) and [wrist stability and host checks](references/olive-man/runtime-and-validation.md) |

`assets/reference-project/` is an unchanged historical r180 example with known limitations. `assets/runtime-kernel/` contains tested, dependency-free calibration math; it is not a skinning/IK engine. The profile and TypeScript contract are adapter designs to implement. Do not inherit the example's identity, licenses, passes or universal renderer compatibility. Source facts and generalization guidance are separated in the source audit.

## Establish inputs

For a new character, use the [appearance brief](assets/APPEARANCE-BRIEF.template.md) and map the resulting asset in `assets/avatar-profile.template.json`. Give written choices precedence where they explicitly override the photos. **If the clothing choice is missing or unclear, ask before committing to an outfit.** Ask which garments, colors and footwear the user wants, or whether to follow the photos or delegate the design. Respect a clear outfit reference and avoid asking for its details twice. Continue inspecting assets and preparing the shared runtime while clothing is unresolved. Record how you handled unseen features and conflicting views. `null` means unresolved.

For a new likeness, use available 3D authoring tools to construct and rig the reference-derived head. A compatible authorized body, hands and native clips can be retained with new head/neck calibration. For an explicitly supplied finished target character, inspect that asset before integration. If facial topology or finger chains are missing, author or replace that component, or mark the requested capability incomplete. A skill does not grant external-service upload, account, purchase, publication or repository permissions.

```sh
python scripts/validate_profile.py assets/avatar-profile.template.json
python scripts/inspect_glb.py PATH_TO_MODEL.glb --profile PATH_TO_PROFILE.json --out asset-audit.json
```

Run relative to this skill. Metadata checking does not decode deformation, inspect textures or prove an expressive face. See `scripts/README.md` for exact scope.

## Implement in this order when building a new avatar

1. **Construct the identity.** Follow reference10: analyze photos, build fresh neutral geometry, compare undecorated multi-view likeness, retopologize for that anatomy, and author its facial rig and UVs. Save editable source and geometry provenance. Internal comparison is required; ask for user feedback on material uncertainties without imposing an unconditional approval stop. Never record owner acceptance without actual feedback.
2. **Inspect and normalize.** Inventory real joints, skins, parts, morphs, clips, resources and rights. Resolve ambiguous names explicitly. Calibrate units/forward/neutral stance through an outer model group while preserving bind matrices and segment lengths. Derive height/anchors from body landmarks, not raised hands or hair bounds.
3. **Adapt motion.** Map roles to actual sources and loop/one-shot behavior. Prefer native playback for compatible clips; retarget only differing sources using verified reference-pose/anatomical frames. The controller owns world pose once. Use achieved velocity, calibrated stride timing and explicit jump/landing states. Exit preview before resuming keyboard/controller locomotion.
4. **Calibrate feet and hands.** Read reference08. Measure current deformed heel/forefoot support patches in world space. Separate static stance, gait support, swing and airborne phases. Correct ankle/toe orientation and reachable leg placement within per-avatar limits; release overrides in the air. Check both hands in front/side views; calibrate mirrored palm/flexion axes separately and relax fingers only on owned states. Preserve gestures, held props and tracking. Inspect wrists, shoulders and forward neck in the same pose.
5. **Build the expressive face.** Bind per-mesh channels, preserve identity/corrective/external speech weights, and expose neutral/smile/laugh/sad/angry/surprise with intensity/manual controls. Start from the user's desired state; otherwise use neutral for inspection. Compose mood, overrides, blink and gaze with explicit priorities. A slider must cause real deformation. Missing core channels require authoring or an explicit incomplete status.
6. **Integrate the new head and appearance.** Use reference09 for head/body assembly, new anchors and neck seam calibration. Fit eyes, teeth, lashes, hair and clothes to the new geometry. A separate facial skeleton must follow the current body neck/torso chain dynamically, including sitting and running. The endpoint-warp procedure is for subsequent limited edits of this authored face, not constructing a new identity from a donor.
7. **Carry over the production behaviors.** Use reference11 to calibrate quiet breathing, neck and gaze limits, five independently articulated digits on each hand, post-motion hand–body clearance, garment fit and seated support where applicable. Wire each in the real frame sequence and include the controls for inspecting them. Add optional speech only when requested, with reference12.
8. **Integrate and verify.** The host owns renderer, camera, input, navigation, world pose and global frame loop. The avatar owns private mutable animation/face state and releases only owned resources. Match pinned Three core/addons/renderer. Show the actual selected asset in the intended host and evaluate the chosen likeness, outfit and movement in the same build.

Existing-asset repairs can start at the affected subsystem; avoid rebuilding unrelated appearance or working motion.

## Non-obvious invariants

- Evaluate a fresh base pose before additive posture, finger and contact corrections. Never accumulate the same offset each frame.
- Grounded root/collider does not prove grounded shoes. Measure skinned contact geometry; include heel **and** forefoot and the actual footwear design. Do not flatten high heels or force swing/jump feet to the floor.
- Identical bone names do not imply identical axes. Preserve helper/twist chains, lengths, reference corrections and quaternion order. Missing fingers stay unsupported; a 41-bone body does not gain five articulated fingers from a separate 73-bone face donor.
- Do not transfer expressions to a sealed neutral face by nearest-surface matching and assume equivalence. Protect mouth/eyelid topology, teeth, lashes and the neckline through combined body/face poses.
- Shared geometry/materials require ownership. Clone mutable resources before sculpting/masking; independent instances and cached source data must remain intact.
- Separate code and model/texture/motion/decoder rights. Restricted example assets are optional historical references; their restrictions do not become a universal license for other user assets.

## Acceptance and handoff

Use the test/report templates and reference06. For new identities, record geometry provenance and neutral clay likeness separately from dressed/textured appearance and expression tests; different files or passing morph tests do not establish a distinct face. For contact/posture work, record heel/forefoot residual, penetration, stance drift, knee reach, hand silhouette and side-view alignment across relevant clips/phases. Use scale-appropriate, declared tolerances; historical millimeter results do not certify a new avatar. Check front/side/three-quarter neutral, all six emotions, blink during surprise, sit/bend/run and jump release when those features are in scope.

Deliver runnable source, local assets or a clearly labeled authorized installer, resolved mappings/profile, provenance, controls, actual tests/evidence and the implemented runtime API. `assets/runtime-contract.d.ts` is a design, not an implementation. Use `assets/handoff-state.template.json` to record what is pass/fail/blocked/not-run and the next verifiable step.

For this skill's utilities run `python -m unittest discover -s tests -v` and `node --test tests/*.test.mjs`. These cover metadata, configuration and synthetic contact math. The downstream agent uses the actual selected asset for visual and performance acceptance, with the user's chosen scope. State missing authoring/runtime access while completing independent useful work.
