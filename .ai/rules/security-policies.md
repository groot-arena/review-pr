---
name: Security Policies
description: Mandatory security standards for dependencies, supply chain integrity, workflow token permissions, and safe execution.
type: rule
globs: ["package.json", "action.yml", ".github/workflows/**"]
always_apply: false
---

# 🛡️ Security Policies (`security-policies.md`)

## 1. Zero-CVE Dependency Policy
- All project dependencies must have 0 high or critical vulnerabilities.
- Verification command:
  ```bash
  npm audit
  ```
- If an indirect dependency introduces a vulnerability:
  1. Check for official upstream package updates.
  2. If an upstream direct dependency has not updated yet, enforce safe versions via the `overrides` field in `package.json`.

---

## 2. GitHub Actions Supply Chain Integrity
- **Full 40-Character SHA Pinning**:
  - Every external action reference in GitHub Actions workflows must be pinned to its immutable 40-character commit SHA.
  - An inline comment documenting the semantic version tag is mandatory.
  ```yaml
  # Correct:
  uses: actions/checkout@34e114876b0b18e3aaee54bede44ab31e84d412e # v4.3.1

  # Incorrect (Forbidden):
  uses: actions/checkout@v4
  ```

---

## 3. Least-Privilege Permissions
- Every workflow file must explicitly define a top-level `permissions` block granting only the minimum required capabilities:
  ```yaml
  permissions:
    contents: read
    pull-requests: write
  ```
- Workflows that only build or test should specify:
  ```yaml
  permissions:
    contents: read
  ```
- Never use `permissions: write-all`.

---

## 4. Input Sanitization & Secret Hygiene
- Never interpolate untrusted PR data directly into shell script execution blocks (`run:`).
  ```yaml
  # Dangerous:
  run: echo "Processing ${{ github.event.pull_request.title }}"

  # Safe (Pass via Environment Variable):
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Processing $PR_TITLE"
  ```
- Never echo or print tokens (`GITHUB_TOKEN`, personal access tokens) in step logs or action summaries.
