# Local tools

Requires Python 3.10+; uses only the standard library. These tools do not run a browser, download models, inspect skin-weight values, or validate licenses.

```sh
python scripts/validate_profile.py assets/avatar-profile.template.json
python scripts/validate_profile.py resolved-profile.json --resolved
python scripts/inspect_glb.py /path/to/avatar.glb --profile resolved-profile.json --out asset-audit.json
python scripts/inspect_glb.py /path/to/avatar.glb --profile resolved-profile.json --strict
python -m unittest discover -s tests -v
```

`validate_profile.py` returns 0 for a passing checked configuration or 2 for errors. Draft mode permits unresolved fields. Resolved mode requires explicit profile choices/bindings, not proof of a usable asset. It implements only the JSON Schema keyword subset used by the bundled schema; use a complete JSON Schema validator when extending that schema.

`inspect_glb.py` returns 0 when it produces a report; use the report's `capabilityErrors`. With `--strict`, capability errors return 2. Container/input errors return 1. The default input limit is 256 MiB; `--max-mib` changes it. The tool refuses to overwrite its model/profile inputs. It never follows external resource URIs.

Bone heuristics only discover candidates. Persist explicit identifiers after review. Morph bindings use the glTF mesh name or mesh index (not a guessed scene-node name), and exact target name or target index. Across-mesh bindings can share one semantic channel. Unsupported bone-only/hybrid facial rigs are reported as unverified by this morph inspector.

Test fixtures contain synthetic metadata and are not rendered human models. A test pass verifies the tool behavior, not avatar realism.
