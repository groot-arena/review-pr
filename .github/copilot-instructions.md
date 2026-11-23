# GitHub Copilot Instructions

Welcome to `review-pr-action`. This repository utilizes a centralized AI Single Source of Truth (SSOT) located in `.ai/`.

## Mandatory Directives for Copilot

1. **Architecture & Standards SSOT**:
   - Consult [.ai/README.md](../.ai/README.md) for overall architecture, dual-consumption model, and standards.
2. **Coding Standards**:
   - Strict ESM: include `.js` in all relative TypeScript imports.
   - Use `Number.parseInt(str, 10)` and `Number.parseFloat(str)` exclusively; never bare `parseInt`/`parseFloat`.
   - Never use `any`; use Zod schemas and TypeScript strict types.
   - Detailed rules: [.ai/rules/typescript-standards.md](../.ai/rules/typescript-standards.md).
3. **Security Standards**:
   - Zero-CVE dependency posture (`npm audit`).
   - Pin third-party GitHub Actions to 40-character SHAs with version comments.
   - Detailed rules: [.ai/rules/security-policies.md](../.ai/rules/security-policies.md) and [.ai/rules/action-workflow-rules.md](../.ai/rules/action-workflow-rules.md).
4. **Testing & Quality Gates**:
   - Maintain $\ge 80\%$ test coverage on lines, statements, functions, and branches.
   - Run verification: `npm run typecheck && npm run lint && npm run test:coverage`.
   - Playbook: [.ai/skills/build-and-verify/SKILL.md](../.ai/skills/build-and-verify/SKILL.md).
