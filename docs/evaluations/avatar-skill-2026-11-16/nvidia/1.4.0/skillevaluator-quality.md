# SkillEvaluator Validation Report

**Status:** ✅ PASSED
**Publication status:** ⚠️ INCOMPLETE
**Quality config:** packaged, `sha256:298ff2bf62132c8154217b7aa59fc1fd04f28cf75372f55620a2cbcd951d6549`, min score 70
**Generated:** November 16, 2026 at 06:15 PM UTC

## Summary

| Metric | Value |
|--------|-------|
| Validator Results | 1 |
| Validators Run | 1 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Incomplete | 0 |
| Total Issues | 11 unique findings (5 medium) / 11 occurrences / 11 raw records |
| Duplicate Occurrences Reconciled | 0 |

## Finding Reconciliation

| Finding ID | Severity | Finding | Occurrences | Validators |
|------------|----------|---------|-------------|------------|
| `SEF-6d68dab37ccc357a6814` | MEDIUM | Instructions don't mention 'run&#95;script' | 1 | QUALITY |
| `SEF-740453e5661b3b5b6f1e` | MEDIUM | No documented scripts in table format | 1 | QUALITY |
| `SEF-b4cb537a773139d0c2ff` | MEDIUM | Deeply nested references in 02-assets-and-authoring.md | 1 | QUALITY |
| `SEF-bf2d85d8c9d7a282e7ad` | MEDIUM | SKILL&#95;SPEC recommended field missing: 'metadata.author' | 1 | QUALITY |
| `SEF-dd828fd8f6476dc5f3c7` | MEDIUM | SKILL&#95;SPEC recommended field missing: 'metadata.tags' | 1 | QUALITY |
| `SEF-10eee8ad2a8c297d0051` | LOW | Non-doc file in references/: source-snapshot-manifest.json | 1 | QUALITY |
| `SEF-14965ed4bd51afdddcef` | LOW | Description very long (256 chars, recommend 50-150) | 1 | QUALITY |
| `SEF-378f24adfec67572e606` | LOW | No troubleshooting section documented | 1 | QUALITY |
| `SEF-4a6560f4aec006f302f9` | LOW | No prerequisites/requirements documented | 1 | QUALITY |
| `SEF-b6533ad44b39dbc6d0d2` | LOW | No '&#35;&#35; Purpose' section | 1 | QUALITY |
| ... | | *1 more unique findings* | | |

## Quality Score

| Skill | Score | Grade | Type | Correctness | Discoverability | Reliability | Efficiency |
|-------|-------|-------|------|-------------|-----------------|-------------|------------|
| avatar-threejs-builder | 81.0 | B | hybrid | 70.0 | 90.0 | 85.0 | 85.0 |

## Results

### ✅ B QUALITY
*Skill quality scoring across Correctness (35%), Discoverability (25%), Reliability (25%), and Efficiency (15%)*

**Overall: 81.0/100 (Grade: B)** | Skill Type: hybrid

| Dimension | Score | Weight |
|-----------|-------|--------|
| Correctness | 70.0 | 35% |
| Discoverability | 90.0 | 25% |
| Reliability | 85.0 | 25% |
| Efficiency | 85.0 | 15% |

- [OK] **quality_score**: Score: 81.0/100 (Grade: B)

**Non-blocking findings: 11**

| Severity | Issue | Location |
|----------|-------|----------|
| [MED] MEDIUM | No documented scripts in table format | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | Instructions don't mention 'run_script' | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | SKILL_SPEC recommended field missing: 'metadata.author' | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | SKILL_SPEC recommended field missing: 'metadata.tags' | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | Description very long (256 chars, recommend 50-150) | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No '## Purpose' section | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No prerequisites/requirements documented | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No limitations documented | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No troubleshooting section documented | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | Deeply nested references in 02-assets-and-authoring.md | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| ... | *1 more issues* | |

<details>
<summary>View Details</summary>

**1. No documented scripts in table format**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-740453e5661b3b5b6f1e`
- Occurrence ID: `SEO-238e127126faf801ec4a`
- Fix: Add '## Available Scripts' with table: | Script | Purpose | Arguments |

**2. Instructions don't mention 'run_script'**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-6d68dab37ccc357a6814`
- Occurrence ID: `SEO-3e22c3935d4f1b64e7ec`
- Fix: Add explicit run_script() call examples

**3. SKILL_SPEC recommended field missing: 'metadata.author'**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-bf2d85d8c9d7a282e7ad`
- Occurrence ID: `SEO-80425831c62ab9aadc61`
- Fix: Add 'author' under metadata: — Author name or team (under metadata:)

**4. SKILL_SPEC recommended field missing: 'metadata.tags'**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-dd828fd8f6476dc5f3c7`
- Occurrence ID: `SEO-f91d034bbc15d4b9e166`
- Fix: Add 'tags' under metadata: — Categorization tags (under metadata:, list of 1-5 items)

**5. Description very long (256 chars, recommend 50-150)**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_discoverability`
- Finding ID: `SEF-14965ed4bd51afdddcef`
- Occurrence ID: `SEO-4436c6ea3dc0a840b040`
- Fix: Keep descriptions concise for progressive disclosure

**6. No '## Purpose' section**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_discoverability`
- Finding ID: `SEF-b6533ad44b39dbc6d0d2`
- Occurrence ID: `SEO-e31aedf62bdb2fe778e6`
- Fix: Add purpose section to clarify use cases

**7. No prerequisites/requirements documented**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_reliability`
- Finding ID: `SEF-4a6560f4aec006f302f9`
- Occurrence ID: `SEO-9468065fd70fe815f835`
- Fix: Document dependencies, API keys, or setup needed

**8. No limitations documented**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_reliability`
- Finding ID: `SEF-fc6fe3747c071963a76e`
- Occurrence ID: `SEO-6a50cedf6a996797e9e8`
- Fix: Add '## Limitations' section with known issues/constraints

**9. No troubleshooting section documented**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_reliability`
- Finding ID: `SEF-378f24adfec67572e606`
- Occurrence ID: `SEO-633a9ec558fa106f7b61`
- Fix: Add '## Troubleshooting' with Error/Cause/Solution patterns

**10. Deeply nested references in 02-assets-and-authoring.md**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.4.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_efficiency`
- Finding ID: `SEF-b4cb537a773139d0c2ff`
- Occurrence ID: `SEO-d5a5c73fc923086c692b`
- Fix: Keep references one level deep from SKILL.md

*... and 1 more issues*

</details>


---
*Generated by SkillEvaluator*