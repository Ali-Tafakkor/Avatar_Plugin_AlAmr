---
name: avatar-threejs-builder
description: "Build or repair customizable full-body web avatars with Three.js: rig and motion adapters, facial emotions, natural hands and posture, and calibrated shoe-ground contact. Use for new characters, GLB integration, retargeting, floating heels, splayed fingers or expressive faces in any web host. Not for portrait images or talking-head video generation."
metadata:
  version: "1.1.0"
  language: "en"
  provenance: "Historical Motion Lab snapshot plus generalized lessons from an accepted hybrid; no character assets included"
---

# Customizable Web Avatar Builder

Build the user's character and a reusable web runtime. Identity, clothes, proportions and style are inputs; preserve the common full-body rig, locomotion, jump, facial-emotion and lifecycle architecture. Plain Three.js, React Three Fiber and other compatible web hosts are valid. Al-Amr, a particular male character, 1.78m height, purple clothes, exactly 66 morphs, fixed motion speeds or two separate rigs are not requirements.

This skill is an engineering/authoring workflow, not a text-to-3D model or a prebuilt avatar factory. Appearance text needs an actual selected or authored asset. Never present a portrait image, parameter file or static mesh as a completed expressive rig.

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
| Copying the historical example | [07-source-audit.md](references/07-source-audit.md) |
| Full-body build, heel/toe contact, hands, shoulders or neck defects | [08-contact-and-posture.md](references/08-contact-and-posture.md) |
| Identity sculpting or combining a body and a facial rig | [09-customization-and-hybrid.md](references/09-customization-and-hybrid.md) |

`assets/reference-project/` is an unchanged historical r180 example with known limitations. `assets/runtime-kernel/` contains tested, dependency-free calibration math; it is not a skinning/IK engine. The profile and TypeScript contract are adapter designs to implement. Do not inherit the example's identity, licenses, passes or universal renderer compatibility. Source facts and generalization guidance are separated in the source audit.

## Establish inputs

Use `assets/avatar-profile.template.json`. Keep the art brief (`appearance`) separate from actual files (`assets`), coordinate/rig mappings, per-role motion sources, contact/posture calibration and face channels. Ask only for information that materially changes the work and is unavailable; record nonblocking choices as provisional. A reference photo is optional unless likeness requires it. `null` means unresolved, never a fabricated asset, hash or capability.

Prefer a compatible user-provided/authorized asset. If a custom model is needed, use available 3D authoring tools to build/rig/skin it. Preserve a usable body rig and native clips. If facial topology or finger chains are missing, author or replace that component, or mark the requested capability incomplete. A skill does not grant external-service upload, account, purchase, publication or repository permissions.

```sh
python scripts/validate_profile.py assets/avatar-profile.template.json
python scripts/inspect_glb.py PATH_TO_MODEL.glb --profile PATH_TO_PROFILE.json --out asset-audit.json
```

Run relative to this skill. Metadata checking does not decode deformation, inspect textures or prove an expressive face. See `scripts/README.md` for exact scope.

## Implement in this order when building a new avatar

1. **Inspect and normalize.** Inventory real joints, skins, parts, morphs, clips, resources and rights. Resolve ambiguous names explicitly. Calibrate units/forward/neutral stance through an outer model group while preserving bind matrices and segment lengths. Derive height/anchors from body landmarks, not raised hands or hair bounds.
2. **Adapt motion.** Map roles to actual sources and loop/one-shot behavior. Prefer native playback for compatible clips; retarget only differing sources using verified reference-pose/anatomical frames. The controller owns world pose once. Use achieved velocity, calibrated stride timing and explicit jump/landing states. Exit preview before resuming keyboard/controller locomotion.
3. **Calibrate feet and hands.** Read reference08. Measure current deformed heel/forefoot support patches in world space. Separate static stance, gait support, swing and airborne phases. Correct ankle/toe orientation and reachable leg placement within per-avatar limits; release overrides in the air. Check both hands in front/side views; calibrate mirrored palm/flexion axes separately and relax fingers only on owned states. Preserve gestures, held props and tracking. Inspect wrists, shoulders and forward neck in the same pose.
4. **Build the expressive face.** Bind per-mesh channels, preserve identity/corrective/external speech weights, and expose neutral/smile/laugh/sad/angry/surprise with intensity/manual controls. Start from the user's desired state; otherwise use neutral for inspection. Compose mood, overrides, blink and gaze with explicit priorities. A slider must cause real deformation. Missing core channels require authoring or an explicit incomplete status.
5. **Customize without breaking deformation.** Use reference09 for new identity/face/clothes. Preserve native eyelid/lip topology. For a point warp F, transform every relative morph as F(base+delta)-F(base), including required normal/attachment work. A separate facial skeleton must follow the current body neck/torso chain dynamically, including sitting and running.
6. **Integrate and verify.** The host owns renderer, camera, input, navigation, world pose and global frame loop. The avatar owns private mutable animation/face state and releases only owned resources. Match pinned Three core/addons/renderer. Show the actual selected asset in a local inspection scene and test the requested features, not an unrelated historical demo.

Existing-asset repairs can start at the affected subsystem; avoid rebuilding unrelated appearance or working motion.

## Non-obvious invariants

- Evaluate a fresh base pose before additive posture, finger and contact corrections. Never accumulate the same offset each frame.
- Grounded root/collider does not prove grounded shoes. Measure skinned contact geometry; include heel **and** forefoot and the actual footwear design. Do not flatten high heels or force swing/jump feet to the floor.
- Identical bone names do not imply identical axes. Preserve helper/twist chains, lengths, reference corrections and quaternion order. Missing fingers stay unsupported; a 41-bone body does not gain five articulated fingers from a separate 73-bone face donor.
- Do not transfer expressions to a sealed neutral face by nearest-surface matching and assume equivalence. Protect mouth/eyelid topology, teeth, lashes and the neckline through combined body/face poses.
- Shared geometry/materials require ownership. Clone mutable resources before sculpting/masking; independent instances and cached source data must remain intact.
- Separate code and model/texture/motion/decoder rights. Restricted example assets are optional historical references; their restrictions do not become a universal license for other user assets.

## Acceptance and handoff

Use the test/report templates and reference06. For contact/posture work, record heel/forefoot residual, penetration, stance drift, knee reach, hand silhouette and side-view alignment across relevant clips/phases. Use scale-appropriate, declared tolerances; historical millimeter results do not certify a new avatar. Check front/side/three-quarter neutral, all six emotions, blink during surprise, sit/bend/run and jump release when those features are in scope.

Deliver runnable source, local assets or a clearly labeled authorized installer, resolved mappings/profile, provenance, controls, actual tests/evidence and the implemented runtime API. `assets/runtime-contract.d.ts` is a design, not an implementation. Use `assets/handoff-state.template.json` to record what is pass/fail/blocked/not-run and the next verifiable step.

For this skill's utilities: `python -m unittest discover -s tests -v` and `node --test tests/calibration.test.mjs`. These check metadata/configuration and synthetic math, not a new character render. Run new-asset visual/performance checks on that actual asset; preserve previously accepted outputs and avoid unrelated demonstrations. State missing authoring/runtime access honestly while completing independent useful work.
