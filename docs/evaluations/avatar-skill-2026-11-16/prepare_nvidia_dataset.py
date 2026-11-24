"""Stage the four pilot cases and a routing control for future Harbor trials."""

import argparse
import json
from pathlib import Path
import shutil

from run_trials import HERE, REPO, VERSIONS


def main():
    p = argparse.ArgumentParser()
    p.add_argument("staging", type=Path)
    args = p.parse_args()
    skill = "avatar-threejs-builder"
    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))["cases"]
    entries = [{
        "id": c["id"],
        "prompt": c["prompt"],
        "expected_output": "A concise Persian commissioning note addressing the requested decision, uncertainty, and verifiable acceptance without claiming unperformed authoring or rendering.",
        "assertions": c["checks"],
        "expected_skill": skill,
    } for c in cases]
    entries.append({
        "id": "css-routing-control",
        "prompt": "یک نمونهٔ کوچک HTML و CSS برای وسط‌چین‌کردن متن یک دکمه‌ بنویس؛ هیچ کتابخانه‌ای استفاده نکن.",
        "expected_output": "A minimal and valid HTML/CSS button example using no library.",
        "assertions": ["Shows a valid button", "Centers the text without libraries"],
        "expected_skill": None,
    })
    text = json.dumps({"skill_name": skill, "evals": entries}, ensure_ascii=False, indent=2)
    for version in VERSIONS[1:]:
        original = (REPO / f"Avatar-Builder-Skill-v{version}" / "Avatar-Builder-Skill" / skill)
        staged = args.staging / version / skill
        shutil.copytree(original, staged)
        (staged / "evals" / "evals.json").write_text(text + "\n", encoding="utf-8")
        print(staged.resolve())


if __name__ == "__main__":
    main()
