---
name: build-and-verify
description: Comprehensive verification playbook to compile, typecheck, lint, and execute unit test suites with coverage validation.
type: skill
---

# 🛠️ Skill: Build & Verify (`build-and-verify`)

## Overview
This skill provides the standard, deterministic pipeline for validating changes across `review-pr-action`. Execute this playbook whenever verifying subagent deliverables or preparing for a pull request.

---

## Verification Pipeline Steps

### Step 1: Type Checking
Ensures all TypeScript types, strict ESM imports (`.js`), and module resolutions are valid.
```bash
npm run typecheck
```
- **Success Criteria**: Process exits with code 0 and no diagnostic errors.

### Step 2: Linting
Ensures code adheres to ESLint rules, formatting conventions, and modern JavaScript standards.
```bash
npm run lint
```
- **Success Criteria**: 0 errors, 0 warnings.

### Step 3: Test Execution & Coverage Gate
Runs the full Vitest suite in coverage collection mode.
```bash
npm run test:coverage
```
- **Success Criteria**:
  - All unit and integration tests pass.
  - Coverage meets or exceeds the repository threshold ($\ge 80\%$ on all metrics).

### Step 4: Distribution Build
Compiles TypeScript source into the bundled `dist/index.js` payload.
```bash
npm run build
```
- **Success Criteria**: Clean compilation into `dist/index.js` without bundling errors.

---

## One-Shot Execution Command
```bash
npm run typecheck && npm run lint && npm run test:coverage && npm run build
```
