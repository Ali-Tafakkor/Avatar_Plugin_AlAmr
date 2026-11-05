# Changes

## 0.1.3 — Accepted appearance and release preparation, 2026-11-05

- Include the accepted enhanced face/albedo, rigged detailed hands, hand contact guard, friendly expression presets, lightweight cloth, quiet idle, smooth shortened neck and fitted original garment neckline.
- Remove duplicate embedded image bytes from the externalized V2 buffer losslessly; retain exact geometry, skin, morph, animation and image bytes. Local managed artifact validation now passes.
- Make the root Plugin and portable 0.1.3 copy the canonical delivery. Registry submission/publication remains owner-controlled.

### Microphone work, 2026-10-27

- Fix repetitive mouth closing at every 200ms inference boundary: use rolling acoustic context, real lookahead, interior frames and source-time deduplication. Preserve final voiced context through the first silent hop.
- Add local microphone PCM capture and wav2arkit inference in a dedicated worker.
- Compose speech articulation with existing facial emotion, blink and gaze once; release on silence/stale input/stop.
- Add optional local YAMNet audible-laughter detection with confidence gating and independent smile/cheek overlay.
- Expose typed speech/laughter APIs, selectable microphone, local model/worker URLs and lifecycle diagnostics.
- Preserve accepted 0.1.2 models, sculpt, body animation, material behavior and snapshots. No publication or Git operation is part of this local change.

## 0.1.2 — Accepted hybrid, 2026-10-20

- Add AvatarHybrid and a standalone packaged runtime: V1 body/outfit and eight native clips, V2 jump and a newly sculpted face on the native V2 facial rig.
- Preserve66 facial morphs, six expressions, blink/gaze/manual controls, accepted shoe contact and head/neck synchronization during movement.
- Preserve Avatar03, AvatarWebV2 and prior exports; add typed hybrid adapter/runtime subpaths without changing the platform contract or peers.
- Make the sample Environment consume the installed Plugin with local assets and official Player Rig1.0.0.
- Preserve the accepted experimental output and immutable0.1.1 delivery. Preparation is distinct from Registry submission/publication.

## 0.1.1 — Web V2, 2026-10-17

- Add `AvatarWebV2` with the complete 73-joint body and 66 facial morph channels, all six expressions, blinking, gaze and manual facial controls.
- Correct anatomical sole orientation, knee hinge planes/ranges, stance width and continuous contact/stop blending. Use athletic walk/run profiles at 2.25/6.2 m/s.
- Bundle model, motion, external textures and runtime inside this Plugin; preserve geometry, skin weights and original asset hashes.
- Preserve `Avatar03` and its nine embedded clips as compatible legacy exports.
- Keep the existing Plugin/publisher/slug and platform contract. Raise both product version fields from the consumed 0.1.0 to 0.1.1 once.
- Include asset provenance and restricted-use notices separately from the application code license.

This is a locally prepared release. Registry submission, review and publication are separate states; no published 0.1.1 release is asserted here.
