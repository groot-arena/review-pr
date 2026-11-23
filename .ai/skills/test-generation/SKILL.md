---
name: test-generation
description: Playbook for authoring deterministic Vitest suites, edge-case coverage fixtures, and simulated action executions.
type: skill
---

# 🧪 Skill: Test Generation (`test-generation`)

## Overview
This skill instructs agents on how to generate unit tests, synthetic coverage fixtures, and integration test scenarios for `review-pr-action`.

---

## Fixture Construction Principles

### 1. Unified Diff Fixtures
When crafting mock Git diffs for testing diff-coverage calculations:
- Include hunk headers with precise line numbers (`@@ -10,4 +10,6 @@`).
- Test additions (`+`), deletions (`-`), and unchanged context lines (` `).
- Test multi-file diffs and renamed files.

### 2. LCOV Coverage Fixtures
Format LCOV fixtures according to standard LCOV specifications:
```text
TN:
SF:src/example.ts
FN:1,sampleFunc
FNDA:1,sampleFunc
FNF:1
FNH:1
DA:1,1
DA:2,0
LF:2
LH:1
end_of_record
```

### 3. Cobertura XML Fixtures
Ensure XML adheres to Cobertura DTD specifications:
- Include valid `<coverage>`, `<packages>`, `<classes>`, `<lines>` tags.
- Test line attributes `number`, `hits`, and `branch="true|false"`.

---

## Test Suite Template (Vitest)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateDiffCoverage } from '../src/engine/diff-coverage.js';

describe('Diff Coverage Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly calculates 100% coverage when all modified lines are hit', () => {
    // Arrange
    const diff = ...;
    const coverage = ...;

    // Act
    const result = calculateDiffCoverage(diff, coverage);

    // Assert
    expect(result.diffCoverage).toBe(100);
    expect(result.uncoveredLines).toHaveLength(0);
  });
});
```

---

## Verification
After adding new tests:
```bash
npm test
npm run test:coverage
```
Ensure test coverage meets or exceeds $\ge 80\%$.
