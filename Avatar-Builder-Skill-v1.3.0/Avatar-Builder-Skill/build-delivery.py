"""Validate and package this skill; never install, upload or generate a character."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
import zipfile

ROOT = Path(__file__).resolve().parent
SKILL = ROOT / 'avatar-threejs-builder'
VALIDATION = ROOT / 'validation'
VERSION = '1.3.0'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def files_under(root):
    for path in sorted(root.rglob('*')):
        if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
            raise ValueError(f'Refusing linked package path: {path}')
        if any(p in ('__pycache__', '.git', 'node_modules') for p in path.relative_to(root).parts):
            continue
        if path.is_file() and path.suffix not in ('.pyc', '.pyo'):
            yield path


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def run(args, output):
    env = dict(os.environ, PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
    result = subprocess.run(args, cwd=SKILL, env=env, capture_output=True, text=True,
                            encoding='utf-8', errors='replace', shell=False)
    log = result.stdout + result.stderr
    output.write_text(log, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(f'{args[0]} failed ({result.returncode}); see {output}\n{log[-3000:]}')
    return log


def original_integrity():
    inventory = json.loads((VALIDATION / 'input-inventory.json').read_text(encoding='utf-8'))
    original = ROOT.parent.parent / 'Avatar-Builder-Skill-v1.0.0' / 'Avatar-Builder-Skill'
    if not original.exists():
        return {'status': 'not-available', 'reason': 'Original package is not beside this portable copy.'}
    expected = {i['path']: i for i in inventory['files']}
    actual = {p.relative_to(original).as_posix(): p for p in files_under(original)}
    if set(expected) != set(actual):
        raise ValueError('Original package file inventory changed')
    for name, item in expected.items():
        if actual[name].stat().st_size != item['bytes'] or digest(actual[name]) != item['sha256']:
            raise ValueError(f'Original package changed: {name}')
    return {'status': 'pass', 'files': len(expected), 'scope': 'Original 1.0.0 bytes preserved'}


def local_links():
    count = 0
    # Check authored skill guidance; code fences and external links are not destinations.
    for path in [SKILL / 'SKILL.md', *sorted((SKILL / 'references').rglob('*.md')),
                 SKILL / 'assets/runtime-kernel/README.md']:
        source = re.sub(r'```.*?```', '', path.read_text(encoding='utf-8'), flags=re.S)
        for target in re.findall(r'\]\(([^)\s]+)\)', source):
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
                continue
            dest = (path.parent / target.split('#', 1)[0]).resolve()
            if not dest.is_file() or not dest.is_relative_to(ROOT):
                raise ValueError(f'Broken/outside local link in {path.name}: {target}')
            count += 1
    return count


def validate():
    VALIDATION.mkdir(exist_ok=True)
    py = run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-v'],
             VALIDATION / 'utility-tests.txt')
    test_paths = sorted(path.relative_to(SKILL).as_posix() for path in (SKILL / 'tests').glob('*.test.mjs'))
    node = run(['node', '--test', '--test-reporter=tap', *test_paths],
               VALIDATION / 'calibration-tests.tap')
    draft = run([sys.executable, 'scripts/validate_profile.py', 'assets/avatar-profile.template.json'],
                VALIDATION / 'profile-draft-check.json')
    python_count = int(re.search(r'Ran (\d+) tests?', py).group(1))
    node_count = int(re.search(r'^# tests (\d+)$', node, re.M).group(1))
    if json.loads(draft)['status'] != 'pass':
        raise ValueError('Draft profile check did not pass')
    schema_status = 'not-run (install jsonschema for full Draft 2020-12 validation)'
    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        pass
    else:
        schema = json.loads((SKILL / 'assets/avatar-profile.schema.json').read_text(encoding='utf-8'))
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(json.loads((SKILL / 'assets/avatar-profile.template.json').read_text(encoding='utf-8')))
        schema_status = 'pass (full Draft 2020-12 schema and draft template)'
    agent_yaml = 'not-run (install PyYAML for YAML parsing)'
    try:
        import yaml
    except ImportError:
        pass
    else:
        text = (SKILL / 'SKILL.md').read_text(encoding='utf-8')
        front = yaml.safe_load(text.split('---', 2)[1])
        agent = yaml.safe_load((SKILL / 'agents/openai.yaml').read_text(encoding='utf-8'))
        if (front['name'] != SKILL.name or front['metadata']['version'] != VERSION
                or not front['description'] or f'${SKILL.name}' not in agent['interface']['default_prompt']):
            raise ValueError('Invalid skill or agent metadata')
        agent_yaml = 'pass (skill frontmatter and agent interface)'
    manifest = json.loads((SKILL / 'references/source-snapshot-manifest.json').read_text(encoding='utf-8'))
    source_root = SKILL / 'assets/reference-project'
    for item in manifest['files']:
        path = source_root / item['path']
        if path.stat().st_size != item['bytes'] or digest(path) != item['sha256']:
            raise ValueError(f'Historical source changed: {item["path"]}')
    result = {
        'version': VERSION, 'testedAtUtc': datetime.now(timezone.utc).isoformat(),
        'python': sys.version.split()[0], 'node': subprocess.check_output(['node', '--version'], text=True).strip(),
        'pythonUtilityTests': {'status': 'pass', 'count': python_count, 'scope': 'Synthetic configuration and GLB metadata'},
        'javascriptMathTests': {'status': 'pass', 'count': node_count,
                                'scope': 'Synthetic sole and hand contact, reach, pose and morph math'},
        'fullJsonSchema': schema_status, 'yamlMetadata': agent_yaml,
        'localGuidanceLinks': {'status': 'pass', 'checked': local_links()},
        'originalPackage': original_integrity(),
        'historicalSourceHashes': {'status': 'pass', 'files': len(manifest['files'])},
        'historicalSourceTests': {'status': 'not-rerun', 'previousCount': 36},
        'prospectiveAgentCases': len(json.loads((SKILL / 'evals/scenarios.json').read_text(encoding='utf-8'))['cases']),
        'agentCasesExecuted': 0, 'newCharacterRender': 'not-run', 'crossHostRuntime': 'not-run',
        'globalInstall': False, 'publication': False,
        'skillInputHashes': {p.relative_to(SKILL).as_posix(): digest(p) for p in files_under(SKILL)},
    }
    write_json(VALIDATION / 'summary.json', result)
    (VALIDATION / 'REPORT.md').write_text(f'''# Validation — skill {VERSION}

Checked at {result['testedAtUtc']} with Python {result['python']} and Node {result['node']}.

- Python utilities: **{python_count} passed**; synthetic profiles, GLB metadata and CLI behavior.
- JavaScript calibration math: **{node_count} passed** across sole support, hand contact, reach, fresh-pose composition and morph endpoints.
- Full JSON Schema: {schema_status}.
- YAML metadata: {agent_yaml}.
- Relative guidance links: {result['localGuidanceLinks']['checked']} resolved.
- Historical source: {len(manifest['files'])} files match the preserved snapshot manifest.
- Original package: {json.dumps(result['originalPackage'], ensure_ascii=False)}.
- Agent evaluation: {result['prospectiveAgentCases']} prospective cases; **zero executed by a live agent**.

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
''', encoding='utf-8')
    return result


def portable():
    paths = [SKILL / 'SKILL.md', *sorted((SKILL / 'references').rglob('*.md')),
             SKILL / 'assets/APPEARANCE-BRIEF.template.md', SKILL / 'assets/TEST-REPORT.template.md',
             SKILL / 'assets/avatar-profile.template.json', SKILL / 'assets/runtime-contract.d.ts',
             SKILL / 'assets/facial-presets.json', SKILL / 'assets/runtime-kernel/README.md',
             SKILL / 'assets/runtime-kernel/calibration.mjs', SKILL / 'assets/runtime-kernel/hand-contact.mjs']
    anchors = {p.resolve(): f'resource-{i}' for i, p in enumerate(paths, 1)}
    parts = [f'# Portable Customizable Web Avatar Builder — {VERSION}\n\n'
             'This is consolidated guidance, profile and calibration math. The complete ZIP also contains '
             'the schema, inspectors, tests and historical source. It does not include character binaries '
             'or grant tools, assets or installation. Appearance is the user\'s input; Al-Amr is optional.\n']
    for path in paths:
        body = path.read_text(encoding='utf-8')
        if path.suffix == '.md':
            def link(match):
                raw = match.group(1)
                if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', raw) or raw.startswith('#'):
                    return match.group(0)
                dest = (path.parent / raw.split('#', 1)[0]).resolve()
                if dest in anchors:
                    return '](' + '#' + anchors[dest] + ')'
                if dest.is_relative_to(ROOT):
                    return '](' + dest.relative_to(ROOT).as_posix() + ')'
                return match.group(0)
            body = re.sub(r'\]\(([^)\s]+)\)', link, body)
        else:
            lang = {'.json': 'json', '.ts': 'typescript', '.mjs': 'javascript'}.get(path.suffix, '')
            body = f'````{lang}\n{body}\n````\n'
        parts.append(f'<a id="{anchors[path.resolve()]}"></a>\n\n## Resource: {path.relative_to(SKILL).as_posix()}\n\n{body}')
    (ROOT / 'AVATAR-SKILL-PORTABLE.md').write_text('\n\n'.join(parts), encoding='utf-8')


def package(result):
    current = {p.relative_to(SKILL).as_posix(): digest(p) for p in files_under(SKILL)}
    if current != result['skillInputHashes']:
        raise ValueError('Skill changed since validation; rerun with --validate')
    write_json(ROOT / 'PACKAGE-INFO.json', {
        'name': 'Customizable Web Avatar Builder Skill', 'version': VERSION, 'skillId': SKILL.name,
        'entrypoint': 'avatar-threejs-builder/SKILL.md', 'portable': 'AVATAR-SKILL-PORTABLE.md',
        'guide': 'README-FA.md', 'handoff': 'HANDOFF-FA.txt',
        'sourceSnapshotIncluded': True, 'sourceSnapshotUnchanged': True,
        'binaryAvatarIncluded': False, 'nativeInstallationPerformed': False,
        'utilityTestCount': result['pythonUtilityTests']['count'],
        'calibrationMathTestCount': result['javascriptMathTests']['count'],
        'originalSourceTestCount': 36, 'originalSourceTestsRerun': False,
        'agentEvalCases': result['prospectiveAgentCases'], 'agentEvalCasesExecuted': 0,
        'kernelIncluded': True, 'completeAvatarFactoryImplemented': False,
        'newCharacterRendered': False, 'validation': 'validation/summary.json',
    })
    portable()
    paths = [p for p in files_under(ROOT) if p.name != 'CHECKSUMS.sha256']
    checksums = '\n'.join(f'{digest(p)}  {p.relative_to(ROOT).as_posix()}' for p in paths) + '\n'
    (ROOT / 'CHECKSUMS.sha256').write_text(checksums, encoding='utf-8')
    archive = ROOT.parent / f'Avatar-Builder-Skill-v{VERSION}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as out:
        for path in files_under(ROOT):
            out.write(path, ROOT.name + '/' + path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(archive) as check:
        if check.testzip() is not None:
            raise ValueError('ZIP CRC check failed')
        for path in files_under(ROOT):
            data = check.read(ROOT.name + '/' + path.relative_to(ROOT).as_posix())
            if hashlib.sha256(data).hexdigest() != digest(path):
                raise ValueError(f'ZIP readback mismatch: {path.name}')
    print(json.dumps({'archive': str(archive), 'sha256': digest(archive),
                      'files': len(list(files_under(ROOT))), 'zipReadback': 'pass',
                      'pythonTests': result['pythonUtilityTests']['count'],
                      'mathTests': result['javascriptMathTests']['count']}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validate', action='store_true', help='Rerun utility/math checks before packaging')
    args = parser.parse_args()
    result = validate() if args.validate else json.loads((VALIDATION / 'summary.json').read_text(encoding='utf-8'))
    package(result)


if __name__ == '__main__':
    main()
