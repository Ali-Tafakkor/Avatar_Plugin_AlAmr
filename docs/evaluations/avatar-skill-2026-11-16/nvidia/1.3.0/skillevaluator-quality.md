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
| [MED] MEDIUM | No documented scripts in table format | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | Instructions don't mention 'run_script' | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | SKILL_SPEC recommended field missing: 'metadata.author' | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | SKILL_SPEC recommended field missing: 'metadata.tags' | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | Description very long (256 chars, recommend 50-150) | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No '## Purpose' section | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No prerequisites/requirements documented | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No limitations documented | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [LOW] LOW | No troubleshooting section documented | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| [MED] MEDIUM | Deeply nested references in 02-assets-and-authoring.md | <code>C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md</code> |
| ... | *1 more issues* | |

<details>
<summary>View Details</summary>

**1. No documented scripts in table format**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-740453e5661b3b5b6f1e`
- Occurrence ID: `SEO-e0a08430b2b87aa8a212`
- Fix: Add '## Available Scripts' with table: | Script | Purpose | Arguments |

**2. Instructions don't mention 'run_script'**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-6d68dab37ccc357a6814`
- Occurrence ID: `SEO-cd543aaa1a8c999ef22a`
- Fix: Add explicit run_script() call examples

**3. SKILL_SPEC recommended field missing: 'metadata.author'**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-bf2d85d8c9d7a282e7ad`
- Occurrence ID: `SEO-57b79d5b5da31403a07b`
- Fix: Add 'author' under metadata: — Author name or team (under metadata:)

**4. SKILL_SPEC recommended field missing: 'metadata.tags'**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_correctness`
- Finding ID: `SEF-dd828fd8f6476dc5f3c7`
- Occurrence ID: `SEO-a16dfca78b6bb9b33166`
- Fix: Add 'tags' under metadata: — Categorization tags (under metadata:, list of 1-5 items)

**5. Description very long (256 chars, recommend 50-150)**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_discoverability`
- Finding ID: `SEF-14965ed4bd51afdddcef`
- Occurrence ID: `SEO-e0b7aed5ff4a2f405a3e`
- Fix: Keep descriptions concise for progressive disclosure

**6. No '## Purpose' section**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_discoverability`
- Finding ID: `SEF-b6533ad44b39dbc6d0d2`
- Occurrence ID: `SEO-89e4e99ef3af7e91a690`
- Fix: Add purpose section to clarify use cases

**7. No prerequisites/requirements documented**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_reliability`
- Finding ID: `SEF-4a6560f4aec006f302f9`
- Occurrence ID: `SEO-2f87a5117201bb115c42`
- Fix: Document dependencies, API keys, or setup needed

**8. No limitations documented**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_reliability`
- Finding ID: `SEF-fc6fe3747c071963a76e`
- Occurrence ID: `SEO-edcd1ecff97f55127b99`
- Fix: Add '## Limitations' section with known issues/constraints

**9. No troubleshooting section documented**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_reliability`
- Finding ID: `SEF-378f24adfec67572e606`
- Occurrence ID: `SEO-996fa8d1e76012b687cc`
- Fix: Add '## Troubleshooting' with Error/Cause/Solution patterns

**10. Deeply nested references in 02-assets-and-authoring.md**
- File: `C:\Files\Programming\Avatar_Al_Amr\Avatar-Builder-Skill-v1.3.0\Avatar-Builder-Skill\avatar-threejs-builder\SKILL.md`
- Check: `quality_efficiency`
- Finding ID: `SEF-b4cb537a773139d0c2ff`
- Occurrence ID: `SEO-38203ad9d9eb500c54d0`
- Fix: Keep references one level deep from SKILL.md

*... and 1 more issues*

</details>


---
*Generated by SkillEvaluator*