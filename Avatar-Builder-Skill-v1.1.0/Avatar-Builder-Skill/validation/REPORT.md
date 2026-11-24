# Validation — skill 1.1.0

Checked at 2026-10-22T06:15:33.740161+00:00 with Python 3.13.4 and Node v24.14.0.

- Python utilities: **56 passed**; synthetic profiles, GLB metadata and CLI behavior.
- JavaScript calibration math: **16 passed**; bounded contact, scaling, airborne release, fresh-pose composition and coherent morph endpoints.
- Full JSON Schema: pass (full Draft 2020-12 schema and draft template).
- YAML metadata: pass (skill frontmatter and agent interface).
- Relative guidance links: 11 resolved.
- Historical source: 31 files match the preserved snapshot manifest.
- Original package: {"status": "pass", "files": 67, "scope": "Original 1.0.0 bytes preserved"}.
- Agent evaluation: 21 prospective cases; **zero executed by a live agent**.

These checks do not generate or render a new character. Actual shoe contact,
skin weights, natural hand silhouettes, face quality, clothing deformation,
performance, cross-host integration and XR remain asset/runtime acceptance work.
The 36 original-source tests and reports under validation-v1.0.0 are historical;
they were not rerun as part of this revision. Model binaries are not bundled.

The Codex skill-creator quick validator was also run separately; see
skill-creator-check.txt when present. It does not prove behavioral quality.
Run `python build-delivery.py --validate` from the outer package folder to repeat
local checks and recreate the portable text, checksum list and ZIP. Python and
Node are required; PyYAML/jsonschema enable the full metadata checks above.
