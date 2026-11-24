# Skill package validation report

Date: 22 October 2026
Package: Avatar Builder Skill 1.0.0
Skill ID: `avatar-threejs-builder`

## Executed in this delivery

| Check | Result | Evidence |
|---|---|---|
| Python utility tests | **39 passed** | `skill-tools-tests.txt` |
| Frozen original Node source tests | **36 passed** | `reference-source-tests.tap` |
| Draft profile validation | **Passed with expected unresolved-field warnings** | `profile-draft-check.json` |
| Complete Draft 2020-12 schema validation | **Passed** using the installed `jsonschema` validator | `package-checks.json` |
| Skill metadata / agent YAML | **Parsed successfully** | `package-checks.json` |
| Original source snapshot identity | **31 files byte-identical** to source ZIP | `package-checks.json` and skill `references/source-snapshot-manifest.json` |
| Literal file references in core SKILL.md | **Resolved** | `package-checks.json` |
| JSON files / prospective evaluation cases | **Parsed; 13 cases present** | `package-checks.json` |

Python: `3.13.5`
Node: `v22.16.0`

The 39 tests cover the supplied configuration/metadata tools, including malformed GLB containers, missing/ambiguous rig roles, bilateral facial-channel coverage, explicit bindings, decoder/external-reference reporting, read-only behavior, CLI exits and source checksums. Fixtures are synthetic metadata, not real renderable humans.

The 36 Node tests exercise the unchanged historical prototype's logic/extractor/server. They do **not** validate the new generalized API or fixes required by the source audit. In particular, the old source's test about clearing unrelated morphs documents old behavior, not the new channel-ownership contract.

## Not executed / not established

- Loading/rendering the actual external AvatarSDK GLB or another new character.
- New visual facial, retargeting, gait, foot-contact or camera quality checks.
- New performance benchmarks or asset-license clearance.
- Implementing or running the proposed `createAvatar` public API.
- Installing the skill into a user's ChatGPT/Codex account or native plugin host.
- End-to-end adherence evaluation against another live GPT agent. The 13 scenarios are prospective, not benchmark results.
- Re-running the original browser UI-shell checks. Historical logs remain in the source snapshot without changed status.

## Distribution scope

The full ZIP contains instructions, technical references, templates, utility scripts/tests, prospective evals and the original source-only demo snapshot. It contains no avatar GLB, downloaded Three.js library, captured motion asset, font file or private face photograph.

The portable Markdown copy contains the full workflow/references and selected templates but not executable helper scripts or the complete original source. Use the full ZIP for exact source/tool access.

Checksums in `../CHECKSUMS.sha256` cover packaged files other than that checksum file itself. They detect accidental changes but are not a signature or license certificate. The skill documents a reproducible workflow; the intended host must still expose appropriate tools and follow/validate the instructions.
