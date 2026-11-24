# Imported custom metrics

External observations — SkillEvaluator did not execute these tests or verify their source claims.
Only JSON validation, custom-metric aggregation and paired comparison ran locally.
No canonical dimensions, Overall, pass/fail or publication evidence are assigned.

Source SHA-256: `e8d1035dc58aa9781e5ba6f34672ebf689c974fe40f48c4f89fa5f6e9cb80ff3`
Imported at: 2026\-11\-16T18:41:32\.730497\+00:00

## Declared provenance and evaluation context

- producer: avatar\-builder offline pilot v1; single reviewer
- run\_id: local\-run\-standalone\-1\.4\.0\-vs\-baseline
- created\_at: 2026\-11\-16T18:41:27\+00:00
- dataset\_id: avatar\-builder\-preflight\-standalone
- dataset\_version: 1
- skill\_id: avatar\-threejs\-builder
- skill\_version: 1\.4\.0 vs baseline
- agent: offline chat response, no tools
- agent\_version: version: 0\.9\.0\-dev \(build 1, commit 6c01da6\)
- model: gemma\-4\-E4B\-it\-Q4\_K\_M\.gguf
- environment: llama\.cpp Windows offline IPv4 loopback, reasoning off, greedy

## Custom scores (0-1)

Arm scores are means over available observations; n/total shows coverage, not test success.
Missing scores are excluded, never replaced with zero.

| Custom metric | Version | Unit | Direction | With skill (n/total) | Without skill (n/total) | Paired delta | Improvement | Paired cases/attempts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| all\_decision\_criteria\_met | 1 | fraction | higher\_is\_better | 0.0000 (4/4) | 0.0000 (4/4) | 0.0000 | 0.0000 | 4/4 |
| decision\_criteria\_met | 1 | fraction | higher\_is\_better | 0.4000 (4/4) | 0.1500 (4/4) | 0.2500 | 0.2500 | 4/4 |
| input\_context\_fraction\_8192 | 1 | fraction\_of\_8192 | lower\_is\_better | 0.5737 (4/4) | 0.0244 (4/4) | 0.5493 | -0.5493 | 4/4 |

Paired delta is with-skill minus without-skill for matching case/attempt IDs in this declared context.
Matched attempt deltas are averaged within each case, then equally across cases.
It may differ from subtraction of arm means when coverage differs.
Improvement reverses the delta for lower-is-better metrics; positive means better.
NO SCORE means no compatible scored pairs, not zero lift. No statistical significance is claimed.
