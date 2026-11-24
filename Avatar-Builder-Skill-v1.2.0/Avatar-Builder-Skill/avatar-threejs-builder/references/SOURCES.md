# Sources and verification notes

Checked for this package: 22 October 2026. Documentation and service interfaces can change. Pin the runtime version used by the project; recheck current platform installation guidance before automating installation.

The primary evidence for the original method is the bundled source snapshot and its hashes, not a reconstructed memory of the previous conversation. The technical architecture and new API are design recommendations derived from that source.

## Primary technical sources

- **[S1] Khronos glTF 2.0 specification.** Skins, morph targets, animation, GLB container, scene structure and metadata. https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- **[S2] Three.js SkinnedMesh.** Skeleton, skin indices/weights, bind matrices and animated bounds. https://threejs.org/docs/pages/SkinnedMesh.html
- **[S3] Three.js Mesh.** `morphTargetDictionary` and `morphTargetInfluences`. https://threejs.org/docs/pages/Mesh.html
- **[S4] Three.js GLTFLoader.** Import, decoder/texture-loader integration and bitmap disposal note. https://threejs.org/docs/pages/GLTFLoader.html
- **[S5] Three.js SkeletonUtils.** Skeleton cloning/retargeting utilities; check the project's pinned version. https://threejs.org/docs/pages/module-SkeletonUtils.html
- **[S6] Three.js AnimationMixer.** Per-object animation control. https://threejs.org/docs/pages/AnimationMixer.html
- **[S7] Three.js AnimationAction.** Playback weights, times, fades and loop controls. https://threejs.org/docs/pages/AnimationAction.html
- **[S8] Original sample provenance.** URLs, commits and rights caveats are preserved in `assets/reference-project/THIRD_PARTY_NOTICES.md`. The sample binary is not included and was not rendered during this skill build. Historical source URL: https://github.com/met4citizen/TalkingHead/blob/2afe6d79779313db8909badebf46f9805a6c7b70/README.md

## Revision1.1.0 verification

S1, S2, S3 and S5 were opened and checked on22 October2026. In particular,
Mesh.getVertexPosition returns animated local-space positions, and
SkeletonUtils.clone preserves shared geometry/material references. Recheck
those APIs against the actual pinned Three version; current docs are not
proof of compatibility with the historical r180 example. S4/S6/S7 remain
primary reference links, without claiming they were newly verified here.

References08/09 and the kernel are engineering generalizations informed by
the project's accepted hybrid. Historical measurements are identified as
asset-specific. The original package is preserved separately; its validation
is under validation-v1.0.0 in the outer delivery, not a current result.

Skill installation/discovery varies by agent/runtime. Provide the complete
folder or the portable Markdown plus resources. Verify the target agent's
own documented discovery path; this package does not install itself, use an
account, migrate a GPT or claim an upcoming platform schedule.

## Limits on source interpretation

The glTF/Three.js docs establish available format/runtime mechanisms, not proof of a particular avatar's realism. This package's preset weights, animation tuning and quality gates are engineering/art direction choices. The current Three.js docs may describe features absent from the original r180 source; do not mix addon versions. The standalone package is not an officially registered plugin or automatically installed skill.
