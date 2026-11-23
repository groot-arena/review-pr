---
name: Git Workflow Rules
description: Repository branching strategies, conventional commit standards, dist tracking policies, and PR review hygiene.
type: rule
globs: ["**/*"]
always_apply: false
---

# 🌿 Git Workflow Rules (`git-workflow-rules.md`)

## 1. Branch Strategy
- **`main`**: Protected branch representing the production-ready state.
- **Feature Branches**:
  - Format: `feat/[feature-name]`
  - Example: `feat/agentic-ai-development-rules`
- **Fix Branches**:
  - Format: `fix/[bug-description]`
- **Chore / Refactor Branches**:
  - Format: `chore/[task-name]` or `refactor/[module-name]`

---

## 2. Commit Message Standards (Conventional Commits)
All commit messages must adhere to the Conventional Commits specification:
```text
<type>(<scope>): <short description>

[optional body explaining context and rationale]

[optional footer(s), e.g. BREAKING CHANGE: ... or Closes #123]
```

### Allowed Types:
- `feat`: A new feature or capability.
- `fix`: A bug fix.
- `docs`: Documentation only changes.
- `style`: Changes that do not affect the meaning of code (whitespace, formatting).
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves performance.
- `test`: Adding missing tests or correcting existing tests.
- `chore`: Changes to build process, auxiliary tools, or dependencies.

---

## 3. Distribution Tracking Policy (`dist/`)
- On feature and bugfix branches, `dist/` is NOT committed to git.
  - This prevents massive merge conflicts and keeps PR reviews focused strictly on human-readable source code.
- Prior to releasing a version tag (or inside the automated release workflow), `dist/index.js` is compiled via `npm run build` and committed to the release tag / release branch.

---

## 4. Pull Request Hygiene
- PR titles must follow Conventional Commits.
- PR descriptions must link to relevant issues and outline:
  - Motivation / context
  - Summary of changes
  - Verification steps performed
- All CI checks (Typecheck, Lint, Vitest, Security Audit) must pass before merging.
