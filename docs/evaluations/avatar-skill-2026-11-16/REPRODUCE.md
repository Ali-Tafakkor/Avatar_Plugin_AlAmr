# Reproduce the Avatar Builder decision pilot

Use Python 3.12+ and NVIDIA SkillEvaluator 0.9.0 at commit `066d43589cd8756fbe3888cc4154216783087fd5`. Run the commands below from the project root with those tools on the current shell's path. The two source skill packages stay in place; put scratch outputs outside the versioned packages.

```powershell
$e = 'docs/evaluations/avatar-skill-2026-11-16'
foreach ($v in '1.3.0','1.4.0') {
  $skill = "Avatar-Builder-Skill-v$v/Avatar-Builder-Skill/avatar-threejs-builder"
  skillevaluator quality-check $skill -r json -r markdown -o "scratch/quality/$v"
}
python "$e/audit_context.py" scratch/context-audit.json
python "$e/prepare_nvidia_dataset.py" scratch/native-cases
```

`audit_context.py` uses `tiktoken`'s public `o200k_base` vocabulary. Its first invocation can fetch the public vocabulary if it is absent from the local cache; the documents are counted locally. The trial runner has no external model endpoint: it starts an existing llama.cpp server in offline mode with a unique IPv4 loopback port and a temporary session key. The model in the original experiment was Gemma 4 E4B Instruct Q4_K_M, llama.cpp build 1 commit `6c01da6`. Supply the local paths to your own copy of the same runtime and model:

```powershell
python "$e/run_trials.py" scratch/local-run --server $localLlamaServer --model $localGemmaGguf --gpu-layers 0 --workers 1
```

For each answer, assign one binary mark per predeclared check in `cases.json`, retaining reasons in the `ratings.json` shape. The Model is shown the requests and supplied references, never the marking rubric. The rubric measures decisions, not rendered output. For a separate replication, shuffle response review and keep the version names hidden from the grader until marking is complete.

```powershell
python "$e/export_metrics.py" scratch/local-run scratch/ratings.json scratch/metrics
Get-ChildItem scratch/metrics -Filter '*.json' | ForEach-Object {
  skillevaluator tier3 import-metrics $_.FullName --output-dir "scratch/import/$($_.BaseName)"
}
```

NVIDIA's external importer validates the declared observations and calculates paired deltas. It does not run or grade the models. `input_context_fraction_8192` is the full prompt-token count returned by llama.cpp divided by the per-slot budget (8,192). For the direct 1.4-versus-1.3 import, the generic `without_skill` arm is explicitly identified as 1.3.0. The prefix cache only reduces local compute, so timing is not used as a comparative metric.
