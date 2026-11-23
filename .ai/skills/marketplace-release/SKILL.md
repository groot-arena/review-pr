---
name: marketplace-release
description: Standard operational procedure for publishing releases to GitHub Marketplace, building dist bundles, and maintaining semantic tags.
type: skill
---

# 🚀 Skill: Marketplace Release (`marketplace-release`)

## Overview
This skill outlines the step-by-step procedure for preparing, validating, and publishing a new release of `review-pr-action` to GitHub Marketplace.

---

## Pre-Release Validation Checklist

1. **Marketplace Metadata (`action.yml`)**:
   - Unique name: `'Review PR - Quality Gates & Diff Coverage'`
   - Categories configured: Primary (`Code quality`), Secondary (`Continuous integration`)
   - Branding configured: `icon` and `color`
2. **Security & Dependencies**:
   - `npm audit` returns 0 vulnerabilities.
   - All third-party actions in `.github/workflows/**` pinned to 40-char commit SHAs.
3. **Quality Gates**:
   - `npm run typecheck` passes.
   - `npm run lint` passes.
   - `npm run test:coverage` passes with $\ge 80\%$ coverage.

---

## Release Procedure

### Step 1: Version Bump
Update version in `package.json` following Semantic Versioning (SemVer):
```bash
# For a patch release (e.g., 1.0.1):
npm version patch --no-git-tag-version

# For a minor release (e.g., 1.1.0):
npm version minor --no-git-tag-version
```

### Step 2: Compile Production Bundle
Compile self-contained distribution bundle:
```bash
npm run build
```
Verify `dist/index.js` was produced.

### Step 3: Commit and Tag
```bash
git add package.json package-lock.json dist/
git commit -m "chore(release): v1.0.1 [skip ci]"
git tag -a v1.0.1 -m "Release v1.0.1"

# Update floating major tag to point to new release
git tag -fa v1 -m "Update v1 tag to v1.0.1"
```

### Step 4: Push to GitHub
```bash
git push origin main
git push origin v1.0.1
git push origin v1 --force
```

### Step 5: Draft GitHub Release & Marketplace Publish
- In GitHub repository UI: Releases -> Draft a new release.
- Choose tag `v1.0.1`.
- Check "Publish this Action to the GitHub Marketplace".
- Confirm category and branding selections.
- Click "Publish release".
