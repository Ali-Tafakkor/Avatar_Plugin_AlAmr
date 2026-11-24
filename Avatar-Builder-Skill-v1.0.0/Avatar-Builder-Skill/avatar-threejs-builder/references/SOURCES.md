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

## Primary agent-platform sources

- **[P1] OpenAI Build skills.** `SKILL.md` metadata, progressive disclosure, local `.agents/skills` discovery and optional `agents/openai.yaml`. https://developers.openai.com/codex/build-skills (also https://learn.chatgpt.com/docs/build-skills)
- **[P2] OpenAI AGENTS.md guidance.** Repository-level instructions and discovery. https://developers.openai.com/codex/agent-configuration/agents-md
- **[P3] OpenAI Creating and editing GPTs.** Instructions versus reference Knowledge; test in Preview. https://help.openai.com/en/articles/8554397-creating-and-editing-gpts
- **[P4] OpenAI Projects in ChatGPT.** Shared project files and instructions. https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- **[P5] OpenAI Custom GPT retirement and migration FAQ.** Account-dependent transition to plugins; current notice gives 11 December 2026 retirement, with some approved Enterprise deferrals. This package does not assume access to any migration/import UI. https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq
- **[P6] OpenAI Skills API guide.** Runtime-specific attachment of reusable instructions/files. https://developers.openai.com/api/docs/guides/tools-skills
- **[P7] OpenAI Testing Agent Skills Systematically.** Prompt/rubric evaluation of a skill. https://developers.openai.com/blog/eval-skills

## Limits on source interpretation

The glTF/Three.js docs establish available format/runtime mechanisms, not proof of a particular avatar's realism. This package's preset weights, animation tuning and quality gates are engineering/art direction choices. The current Three.js docs may describe features absent from the original r180 source; do not mix addon versions. The standalone package is not an officially registered plugin or automatically installed skill.
