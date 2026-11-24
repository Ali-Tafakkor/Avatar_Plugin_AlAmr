"""Run the paired decision pilot on an offline llama.cpp process."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import random
import secrets
import socket
import subprocess
import time
from urllib.error import URLError
from urllib.request import Request, build_opener, ProxyHandler


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
VERSIONS = ("baseline", "1.3.0", "1.4.0")
CONTRACT = (
    "Answer the user in Persian, in at most 180 words. This is a commissioning "
    "decision only. Do not call tools or read files. Use any guidance supplied "
    "below if applicable; the user's request still defines the work."
)
REFS = {
    "fresh-face": "10-reference-likeness-and-clothes.md",
    "eyelid-repair": "04-face-animation.md",
    "body-coat": "13-body-and-garment-shape.md",
    "loose-robe": "13-body-and-garment-shape.md",
}


def skill_inputs(case_id, version):
    if version == "baseline":
        return [], ""
    source = (REPO / f"Avatar-Builder-Skill-v{version}" / "Avatar-Builder-Skill"
              / "avatar-threejs-builder")
    ref = REFS[case_id]
    if version == "1.3.0" and ref.startswith("13-"):
        ref = "10-reference-likeness-and-clothes.md"
    included = ["SKILL.md", f"references/{ref}"]
    text = "\n\n".join((source / name).read_text(encoding="utf-8") for name in included)
    return included, f"<skill_guidance>\n{text}\n</skill_guidance>"


def request(port, api_key, route, payload=None, timeout=10):
    # Ignore the host's HTTP(S) proxies and use only an IPv4 loopback endpoint.
    req = Request(f"http://127.0.0.1:{port}{route}",
                  data=None if payload is None else json.dumps(payload).encode("utf-8"),
                  headers={"Content-Type": "application/json",
                           "Authorization": f"Bearer {api_key}"})
    with build_opener(ProxyHandler({})).open(req, timeout=timeout) as response:
        return json.load(response)


def run_trial(port, api_key, output, case, version, stratum, attempt, blind_id):
    context = []
    included, skill_text = skill_inputs(case["id"], version)
    if skill_text:
        context.append(skill_text)
    if stratum == "project":
        project = (HERE / "project-guidance.txt").read_text(encoding="utf-8")
        context.append(f"<project_guidance>\n{project}\n</project_guidance>")
    prompt = "\n\n".join([CONTRACT, *context, f"<user_request>\n{case['prompt']}\n</user_request>"])
    start = time.monotonic()
    try:
        result = request(port, api_key, "/v1/chat/completions", {
            "model": "avatar-local-eval",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0, "seed": 20261116 + attempt,
            "max_tokens": 640, "cache_prompt": True,
        }, timeout=240)
        choice = result["choices"][0]
        answer = choice["message"]["content"] or ""
        usage = result.get("usage")
        status = 0 if choice["finish_reason"] == "stop" and answer and usage else "incomplete"
    except (URLError, TimeoutError, KeyError, ValueError) as exc:
        answer, usage, status = "", None, f"{type(exc).__name__}: {exc}"
    elapsed = time.monotonic() - start
    record = {
        "id": blind_id, "case_id": case["id"], "version": version, "stratum": stratum,
        "attempt": attempt, "exit": status, "seconds": round(elapsed, 2), "usage": usage,
        "injected_skill_files": included,
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "answer": answer,
    }
    if status == 0 and usage and answer:
        (output / f"{blind_id}.answer.txt").write_text(answer + "\n", encoding="utf-8")
    return record


def main():
    p = argparse.ArgumentParser()
    p.add_argument("output", type=Path)
    p.add_argument("--server", type=Path, required=True)
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--gpu-layers", default="auto")
    p.add_argument("--attempts", type=int, default=1)
    p.add_argument("--workers", type=int, default=1)
    p.add_argument("--cases", nargs="+")
    p.add_argument("--resume-from", type=Path, help="Reuse successful rows from the same trial matrix")
    args = p.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    data = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    cases = [c for c in data["cases"] if not args.cases or c["id"] in args.cases]
    jobs = [
        (case, version, stratum, attempt)
        for attempt in range(1, args.attempts + 1)
        for case in cases
        for stratum in ("standalone", "project")
        if stratum == "standalone" or case["id"] in ("fresh-face", "body-coat")
        for version in (VERSIONS if stratum == "standalone" else ("baseline", "1.4.0"))
    ]
    random.Random(20261116).shuffle(jobs)
    manifest = {
        "model": args.model.name, "contract": CONTRACT,
        "model_runtime": subprocess.check_output([str(args.server), "--version"],
                                                 stderr=subprocess.STDOUT, text=True).strip(),
        "backend": "llama.cpp Windows offline IPv4 loopback, reasoning off, greedy",
        "skill_delivery": "entrypoint and one task-specific reference inline; no routing tested",
        "dataset_sha256": hashlib.sha256((HERE / "cases.json").read_bytes()).hexdigest(),
        "guidance_sha256": hashlib.sha256((HERE / "project-guidance.txt").read_bytes()).hexdigest(),
    }
    numbered = [(f"r{idx:02d}", job) for idx, job in enumerate(jobs, 1)]
    by_id = dict(numbered)
    retained = {}
    if args.resume_from:
        old = json.loads((args.resume_from / "run.json").read_text(encoding="utf-8"))
        if old != manifest:
            raise ValueError("Prior run used a different model or trial contract")
        for line in (args.resume_from / "observations.jsonl").read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            if row["exit"] != 0:
                continue
            case, version, stratum, attempt = by_id[row["id"]]
            if (case["id"], version, stratum, attempt) != (
                    row["case_id"], row["version"], row["stratum"], row["attempt"]):
                raise ValueError("Prior run used a different trial matrix")
            retained[row["id"]] = row
            (output / f"{row['id']}.answer.txt").write_text(row["answer"] + "\n", encoding="utf-8")
    # Reuse exact prompt prefixes only to reduce offline processing time.
    # Each request still includes its full text and has its own output.
    def prefix_group(numbered_job):
        _, (case, version, stratum, attempt) = numbered_job
        files, _ = skill_inputs(case["id"], version)
        return ({"baseline": 0, "1.4.0": 1, "1.3.0": 2}[version], files,
                case["id"], stratum, attempt)

    numbered.sort(key=prefix_group)
    (output / "run.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    cmd = [
        str(args.server.resolve()), "--model", str(args.model.resolve()),
        "--offline", "--host", "127.0.0.1", "--port", str(port),
        "--no-webui", "--no-webui-mcp-proxy", "--cache-prompt", "--no-warmup",
        "--alias", "avatar-local-eval", "--reasoning", "off",
        "--ctx-size", str(args.workers * 8192), "--parallel", str(args.workers),
        "--n-gpu-layers", args.gpu_layers, "--threads", "6", "--threads-batch", "8",
    ]
    if args.gpu_layers == "0":
        cmd += ["--device", "none"]
    api_key = secrets.token_hex(32)
    with (output / "server.log").open("wb") as log:
        proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT,
                                env={**os.environ, "LLAMA_API_KEY": api_key},
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            for _ in range(100):
                if proc.poll() is not None:
                    raise RuntimeError(f"Local inference server exited; see {log.name}")
                try:
                    if request(port, api_key, "/health", timeout=1).get("status") == "ok":
                        break
                except (URLError, TimeoutError):
                    pass
                time.sleep(1)
            else:
                raise TimeoutError(f"Local inference server unavailable; see {log.name}")
            print("Local offline model is ready.", flush=True)
            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = [
                    executor.submit(run_trial, port, api_key, output, *job, blind_id)
                    for blind_id, job in numbered if blind_id not in retained
                ]
                with (output / "observations.jsonl").open("x", encoding="utf-8") as f:
                    for row in retained.values():
                        f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    f.flush()
                    for future in as_completed(futures):
                        result = future.result()
                        f.write(json.dumps(result, ensure_ascii=False) + "\n")
                        f.flush()
                        print(f"{result['id']}: exit={result['exit']}, "
                              f"{result['seconds']}s, usage={result['usage'] is not None}", flush=True)
        finally:
            proc.terminate()
            proc.wait(timeout=15)


if __name__ == "__main__":
    main()
