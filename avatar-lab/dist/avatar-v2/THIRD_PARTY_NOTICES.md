# Third-party sources, scope, and usage limits

## This Plugin release

The Web V2 Plugin now bundles the pinned avatar GLB, externalized textures and extracted motion data for offline loading. Their hashes and source revision are preserved in `dist/assets/avatar-v2/asset-manifest.json` and `provenance.json`. The application uses the host's Three.js 0.185.1 peer; the older starter references below describe the original acquisition at r180. Library code is not relicensed as model or motion rights. This local preparation does not establish additional public redistribution or commercial rights.

## This starter archive

The starter archive contains application source, tests and a local installer. It does **not** contain the avatar GLB, Three.js distribution files, Xbot GLB, or the extracted motion data. `tools/setup.mjs` retrieves them on first launch. No ownership of third-party models, textures, rigs or animation is claimed.

## Avatar: AvatarSDK example from TalkingHead

- Upstream project: https://github.com/met4citizen/TalkingHead
- Pinned revision: `2afe6d79779313db8909badebf46f9805a6c7b70`
- Path: `avatars/avatarsdk.glb`
- Canonical file: https://github.com/met4citizen/TalkingHead/blob/2afe6d79779313db8909badebf46f9805a6c7b70/avatars/avatarsdk.glb
- Upstream Git blob SHA-1: `2865a45b9f82e97e811cc703411233f3be780163`
- Upstream file size: 12,284,040 bytes.
- Attribution: AvatarSDK; example distributed in met4citizen/TalkingHead.
- Upstream README: https://github.com/met4citizen/TalkingHead/blob/2afe6d79779313db8909badebf46f9805a6c7b70/README.md
- The README identifies this avatar as created for **non-commercial use**. This is not a grant from this project's author, and no independent commercial clearance has been obtained. Do not treat TalkingHead's code license, Three.js's MIT license, or this project's code license as the avatar's asset license.
- The `siteconfig.js` entry identifies this example as a male body (`body: 'M'`).
- The original mesh, textures and facial rig are not newly created artwork in this delivery. Application code drives the existing morph targets and skeleton.

Treat this demonstration and the included installer as a non-commercial evaluation workflow. Before commercial deployment or redistribution beyond the applicable permissions, obtain rights for the chosen avatar and its textures or replace it with an appropriately licensed model. A model/texture-rights review has not been performed here.

## Engine: Three.js

- Project: https://github.com/mrdoob/three.js
- Pinned release/tag: `r180`; npm version `0.180.0`.
- License: MIT for Three.js library code, with the upstream license downloaded to `vendor/THREE-LICENSE.txt`.
- Distribution sources: GitHub Raw, jsDelivr npm mirror, unpkg npm mirror.
- Used components: WebGLRenderer, AnimationMixer, GLTFLoader, DRACOLoader, BufferGeometryUtils, RoomEnvironment and meshopt decoder distribution.
- Optional Draco decoder files are downloaded from the same pinned Three.js tag only when the selected GLB declares Draco compression. Retain the notices in upstream decoder files. Embedded/distributed third-party decoder code can have its own notices; the Three.js license alone does not replace those notices.
- GLTFLoader documentation: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- AnimationMixer documentation: https://threejs.org/docs/#api/en/animation/AnimationMixer

No Three.js library text or font files are embedded in this starter archive.

## Motion source: Xbot example

- Canonical source: https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/Xbot.glb
- Example usage: https://github.com/mrdoob/three.js/blob/r180/examples/webgl_animation_skinning_additive_blending.html
- Motion/model provenance: Mixamo example assets distributed in the Three.js examples.
- The installer extracts only node transforms and idle/walk/run animation tracks, then deletes the temporary source GLB. No Xbot visible mesh or textures are retained in this project's runtime.
- These animations are not newly recorded motion capture. Extracting or retargeting does not create new ownership of the source motion. Do not market or resell the source/extracted motion as an independently owned stock asset. Confirm the applicable Mixamo/source terms for distribution or commercial product use.
- The jump/anticipation/landing overlays are application-generated procedural motion, **not** a jump motion-capture recording.

## New application code and generated scene

The original code for the application, local installer, tests, expression-weight presets, camera, controller, procedural environment and UI is provided under the code license in `LICENSE`. This does not extend to remotely obtained model, texture, animation, decoder or library rights.

The scene uses geometry and canvas-generated surface patterns; no third-party environment photo, HDR image, audio, or font file is bundled. Browser/system fonts are referenced by name only.

## Provenance on the user's machine

After successful setup, `assets/provenance.json` records the exact avatar commit/blob, engine version, SHA-256 checksums, sources and byte counts of installed files. Reused cached downloads are marked as cached rather than falsely attributed to a new download. The pinned avatar is validated using its Git blob checksum before acceptance.
