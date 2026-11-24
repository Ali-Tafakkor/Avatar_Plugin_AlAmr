"""Count skill text locally; preflight and freeze the exact trial inputs."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile
from difflib import SequenceMatcher

import tiktoken

from run_trials import HERE, REPO, REFS, VERSIONS, CONTRACT, skill_inputs


TOK = tiktoken.get_encoding("o200k_base")


def cost(text):
    return {"chars": len(text), "tokens_o200k": len(TOK.encode_ordinary(text))}


def entrypoint_sections(text):
    sections = {}
    for section in re.split(r"(?=^## )", text, flags=re.M):
        if section:
            name = (section.splitlines()[0][3:] if section.startswith("## ")
                    else "frontmatter and introduction")
            sections[name] = cost(section)
    return sections


def audit():
    data = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    versions, entries = {}, {}
    for version in VERSIONS[1:]:
        package = REPO / f"Avatar-Builder-Skill-v{version}" / "Avatar-Builder-Skill"
        archive = package.parent / f"Avatar-Builder-Skill-v{version}.zip"
        skill = package / "avatar-threejs-builder"
        skill_text = (skill / "SKILL.md").read_text(encoding="utf-8")
        entries[version] = skill_text
        description = re.search(r'^description:\s*"(.*)"$', skill_text, re.M).group(1)
        references = sorted((skill / "references").rglob("*.md"))
        with zipfile.ZipFile(archive) as z:
            for path in (skill / "SKILL.md", *references):
                assert path.read_bytes() == z.read(path.relative_to(package.parent).as_posix()), path
        entry = cost(skill_text)
        refs = {p.relative_to(skill).as_posix(): cost(p.read_text(encoding="utf-8"))
                for p in references}
        payload = {}
        for case in data["cases"]:
            base = skill_inputs(case["id"], version)
            payload[case["id"]] = {
                "files": {name: hashlib.sha256((skill / name).read_bytes()).hexdigest()
                          for name in base[0]},
                "inline_payload": cost(base[1]),
            }
        versions[version] = {
            "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            "description": cost(description),
            "entrypoint": entry,
            "entrypoint_sections": entrypoint_sections(skill_text),
            "reference_markdown": refs,
            "all_reference_tokens": sum(v["tokens_o200k"] for v in refs.values()),
            "portable_text": cost((package / "AVATAR-SKILL-PORTABLE.md").read_text(encoding="utf-8")),
            "optional_handoff_text": {
                path: cost((package / path).read_text(encoding="utf-8"))
                for path in ("HANDOFF-FA.txt", "GPT-INSTRUCTIONS.txt")
            },
            "exact_trial_skill_payload": payload,
        }
    entry_tokens = [TOK.encode_ordinary(entries[v]) for v in VERSIONS[1:]]
    unchanged = sum(m.size for m in SequenceMatcher(None, *entry_tokens, autojunk=False).get_matching_blocks())
    return {
        "tokenizer": "o200k_base; proxy for deployed model tokenizer",
        "source_newlines": "LF from Python universal newline decoding",
        "project_guidance": cost((HERE / "project-guidance.txt").read_text(encoding="utf-8")),
        "contract": cost(CONTRACT),
        "entrypoint_matched_token_sequence": {
            "method": "difflib.SequenceMatcher on o200k token ID sequences; lexical, not semantic",
            "matched_tokens_in_both": unchanged,
            "share_of_v1_4": round(unchanged / len(entry_tokens[1]), 4),
        },
        "versions": versions,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("output", type=Path)
    args = p.parse_args()
    args.output.write_text(json.dumps(audit(), ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")


if __name__ == "__main__":
    main()
