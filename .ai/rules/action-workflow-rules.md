---
name: Action & Workflow Rules
description: Standards for action.yml metadata, runner configuration, marketplace guidelines, and GitHub Actions workflow structures.
type: rule
globs: ["action.yml", ".github/workflows/**"]
always_apply: false
---

# ⚙️ Action & Workflow Rules (`action-workflow-rules.md`)

## 1. Action Metadata Standards (`action.yml`)
1. **Action Name**:
   - Must be unique, descriptive, and non-conflicting across GitHub Marketplace.
   - Example: `'Review PR - Quality Gates & Diff Coverage'`.
2. **Branding**:
   - `branding.icon`: Must be a valid Feather / Octicon icon name (e.g., `shield-check`, `check-circle`, `terminal`).
   - `branding.color`: Must be an approved GitHub Marketplace branding color (e.g., `green`, `blue`, `purple`, `yellow`, `orange`, `red`, `gray-dark`).
3. **Descriptions**:
   - Root `description` must clearly summarize functionality in 1-2 concise sentences.
   - Every input and output must have an informative `description` and explicit `required` boolean.

---

## 2. Runner & Execution Standards
- Node Runtime: Target modern LTS runner environment (`node20`).
- Main Entrypoint: Points to compiled single-file bundle:
  ```yaml
  runs:
    using: 'node20'
    main: 'dist/index.js'
  ```
- Output Contracts:
  - All outputs declared in `action.yml` must be set via `@actions/core.setOutput(name, value)`.
  - Values must be typed strings or stringified JSON objects.

---

## 3. Workflow Configuration Rules
- All workflows in `.github/workflows/**` must include:
  1. Explicit name (`name: CI`).
  2. Concrete triggers (`on: pull_request:`, `on: push:`).
  3. Top-level `permissions` block (least-privilege).
  4. Explicit concurrency grouping to cancel outdated runs:
     ```yaml
     concurrency:
       group: ${{ github.workflow }}-${{ github.ref }}
       cancel-in-progress: true
     ```
  5. 40-character SHA pinned actions.
