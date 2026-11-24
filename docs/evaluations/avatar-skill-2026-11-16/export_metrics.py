"""Export measured local observations for NVIDIA tier3 import-metrics."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from run_trials import HERE


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("run", type=Path)
    p.add_argument("scores", type=Path)
    p.add_argument("output", type=Path)
    args = p.parse_args()
    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    n_checks = {c["id"]: len(c["checks"]) for c in cases["cases"]}
    meta = json.loads((args.run / "run.json").read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in
            (args.run / "observations.jsonl").read_text(encoding="utf-8").splitlines()]
    marks = json.loads(args.scores.read_text(encoding="utf-8"))
    assert set(marks) == {r["id"] for r in rows if r["exit"] == 0}
    for stratum, left, right in (("standalone", "1.3.0", "baseline"),
                                 ("standalone", "1.4.0", "baseline"),
                                 ("project", "1.4.0", "baseline"),
                                 ("standalone", "1.4.0", "1.3.0")):
        # NVIDIA's arm names are generic. The final comparison's 'without_skill'
        # arm is explicitly labeled as 1.3.0 in the provenance and file name.
        observations = []
        for r in rows:
            if r["stratum"] != stratum or r["version"] not in (left, right):
                continue
            vals = {}
            if r["exit"] == 0:
                checks = marks[r["id"]]["checks"]
                assert len(checks) == n_checks[r["case_id"]] and all(
                    type(v) is int and v in (0, 1) for v in checks)
                count = r["usage"]["prompt_tokens"]
                assert 0 < count <= 8192
                vals = {
                    "decision_criteria_met": sum(checks) / len(checks),
                    "all_decision_criteria_met": float(all(checks)),
                    "input_context_fraction_8192": count / 8192,
                }
            observations.append({
                "case_id": r["case_id"], "attempt": r["attempt"],
                "arm": "with_skill" if r["version"] == left else "without_skill",
                "custom_metrics": vals or {"decision_criteria_met": None},
            })
        if not observations:
            continue
        args.output.mkdir(parents=True, exist_ok=True)
        dump(args.output / f"{stratum}-{left}-vs-{right}.json", {
            "schema_version": "1",
            "evaluation": {
                "dataset_id": cases["id"] + "-" + stratum,
                "dataset_version": cases["version"],
                "skill_id": "avatar-threejs-builder",
                "skill_version": f"{left} vs {right}",
                "agent": "offline chat response, no tools",
                "agent_version": meta["model_runtime"].splitlines()[0],
                "model": meta["model"],
                "environment": meta["backend"],
            },
            "provenance": {
                "producer": "avatar-builder offline pilot v1; single reviewer",
                "run_id": f"{args.run.name}-{stratum}-{left}-vs-{right}",
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            },
            "metric_definitions": {
                "decision_criteria_met": definition("fraction", False),
                "all_decision_criteria_met": definition("fraction", False),
                "input_context_fraction_8192": definition("fraction_of_8192", True),
            },
            "observations": observations,
        })


def definition(unit, lower_is_better):
    return {"version": "1", "unit": unit, "aggregation": "mean",
            "direction": "lower_is_better" if lower_is_better else "higher_is_better"}


if __name__ == "__main__":
    main()
