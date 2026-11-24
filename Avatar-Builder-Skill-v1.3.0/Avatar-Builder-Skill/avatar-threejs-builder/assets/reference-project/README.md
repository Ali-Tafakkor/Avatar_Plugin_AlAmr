# Avatar / Motion Lab

Persian/RTL Three.js desktop avatar-motion and facial-expression prototype.

**Read the Persian setup guide:** [README-FA.md](README-FA.md)

## Run

Requires Node.js 22+. Extract this archive, then double-click
`START-WINDOWS.cmd` on Windows, or run:

```sh
node start.mjs
```

A local-only server opens the browser at `http://127.0.0.1:4173` (or the next
available port). Keep the terminal open. Ctrl+C stops it.

**First launch requires internet.** This source/starter archive does not
include the binary avatar, the engine or motion data. The local installer
retrieves pinned versions and caches them under `assets/` and `vendor/`.
After successful setup:

```sh
node start.mjs --offline
```

No npm install, API key, paid account or cloud inference is required for this
sample workflow. Do not open index.html with file://.

## Controls

WASD/arrows move; Shift runs; Space jumps. Digits 0–5 select neutral, gentle
smile, laughter, sadness, anger and surprise. F: face close-up. V: follow.
C: cycle cameras. Drag: orbit. Wheel: zoom. B: blink. R: reset. H: hide HUD.

The initial view is a face close-up. Moving automatically switches to follow.
The UI includes expression intensity, manual facial groups, blinking/gaze,
foot IK, slow motion, lighting, quality, skeleton and wireframe controls.

## Scope and limits

The avatar is a pre-existing male AvatarSDK sample from TalkingHead, not a
newly sculpted or photogrammetry-scanned character made for this delivery.
The upstream README specifies **non-commercial use** for that sample.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Idle/walk/run data are extracted from the Three.js Xbot example and retargeted.
Jump, breathing, turn lean and landing are procedural overlays. The project
does not claim production-quality motion capture, photoreal skin, a custom
face sculpt or motion matching.

Source-level and local-server tests were executed. The binary assets could
not be downloaded in the build environment; end-to-end GLB rendering,
retarget alignment, facial visual quality and frame-rate were **not** verified.
The UI shell was checked separately without a running 3D model. See
[docs/TEST_REPORT.md](docs/TEST_REPORT.md) for exact test boundaries and a
manual acceptance checklist.

## Tests (do not require asset downloads)

```sh
node --test
```

This project has no npm runtime dependencies. Only downloaded, pinned browser
libraries/assets are needed after setup. Original application code: MIT;
third-party assets and libraries: their own terms, not overridden by MIT.
