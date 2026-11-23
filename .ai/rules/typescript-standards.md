---
name: TypeScript Coding Standards
description: Enterprise TypeScript guidelines including strict ESM extensions, number parsing rules, Zod validation, and typing constraints.
type: rule
globs: ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
always_apply: false
---

# 📘 TypeScript Coding Standards (`typescript-standards.md`)

## 1. Module System & Imports
- **Strict ESM (`NodeNext`)**:
  - Always include the `.js` extension when importing local TypeScript modules:
    ```typescript
    // Correct:
    import { parseLcov } from './parsers/lcov.js';
    import type { CoverageReport } from './types/index.js';

    // Incorrect:
    import { parseLcov } from './parsers/lcov';
    ```
- Use explicit type-only imports:
  ```typescript
  import type { QualityGateConfig } from './types/index.js';
  ```

---

## 2. Number Parsing Guidelines
- **Mandatory `Number` Namespace**:
  - Never call the global `parseInt()` or `parseFloat()` directly.
  - Always use `Number.parseInt(str, 10)` with explicit radix 10.
  - Always use `Number.parseFloat(str)`.
  ```typescript
  // Correct:
  const lineNo = Number.parseInt(match[1], 10);
  const threshold = Number.parseFloat(inputVal);

  // Incorrect:
  const lineNo = parseInt(match[1]);
  const threshold = parseFloat(inputVal);
  ```

---

## 3. Type Safety & Validation
- **No `any` Types**:
  - The `any` type is strictly forbidden.
  - Use `unknown` for unvalidated external inputs, combined with Zod schemas or type guards.
- **Runtime Validation with Zod**:
  - All external inputs (Action inputs, CLI arguments, configuration files) must be validated with Zod:
    ```typescript
    const result = MySchema.safeParse(rawInput);
    if (!result.success) {
      core.setFailed(`Invalid configuration: ${result.error.message}`);
      return;
    }
    const config = result.data;
    ```
- **Immutability**:
  - Prefer `readonly` arrays and `Readonly<T>` properties for domain objects and parsed coverage outputs to prevent accidental mutations.

---

## 4. Pure Functions & Side-Effect Isolation
- Pure domain algorithms (line calculations, diff matching, report markdown rendering) must be pure functions with no side effects.
- Direct interaction with `@actions/core`, `@actions/github`, or Node filesystem (`fs`) must be contained in the action entrypoint (`src/index.ts`) or dedicated adapter modules.

---

## 5. Verification Commands
```bash
npm run typecheck
npm run lint
```
Both commands must pass with zero errors and zero warnings.
