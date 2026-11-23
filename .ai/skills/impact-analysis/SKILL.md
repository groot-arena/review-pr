---
name: impact-analysis
description: Evaluation playbook for analyzing modified paths, identifying affected components, and assessing architectural impact against impact rules.
type: skill
---

# 🔍 Skill: Impact Analysis (`impact-analysis`)

## Overview
This skill guides agents in evaluating pull request changes against the repository's architectural impact rules (`config/default-impact-rules.json`). It ensures that changes triggering critical security, parser, or workflow boundaries receive appropriate reviews and test coverage.

---

## Impact Matrix & Critical Paths

| Path Pattern | Classification | Required Actions |
| :--- | :--- | :--- |
| `src/parsers/**` | Parser Critical | Verify with both valid and malformed LCOV / Cobertura XML fixtures. |
| `src/engine/**` | Algorithm Critical | Require full branch and statement coverage test cases. |
| `src/types/**` | Contract Critical | Run schema compatibility check; ensure no breaking API changes. |
| `action.yml` | Marketplace Critical | Verify unique name, categories, branding, and input defaults. |
| `.github/workflows/**` | Security Critical | Audit 40-char SHA pinning and permissions block. |

---

## Execution Protocol

### Step 1: Extract Git Diff Summary
Identify the set of changed files:
```bash
git status --short
# or for branch diffs against main:
git diff --name-only origin/main...HEAD
```

### Step 2: Compare against `config/default-impact-rules.json`
Inspect rule triggers for each changed file path:
- High impact paths (parsers, core calculations) require companion test additions in `tests/`.
- Schema changes require updating `tests/fixtures/` and type exports.

### Step 3: Flag High-Risk Changes
If any change touches security-sensitive areas (`.github/workflows/`, dependencies, or core execution logic), ensure the `security-auditor` and `test-engineer` subagents review the diff.
