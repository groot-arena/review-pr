---
description: Antigravity repository-level guidelines pointing to .ai SSOT
globs: ["**/*"]
alwaysApply: true
---

# Antigravity Agent Guidelines

This repository is governed by an **AI-Native Orchestrator-Subagent Framework**. The authoritative Single Source of Truth (SSOT) is located in `.ai/`.

## Master Reference
- **Master SSOT & Router**: Read [.ai/README.md](../../.ai/README.md)
- **Universal Gateway**: Read [AGENTS.md](../../AGENTS.md)

## Core Working Directives
1. **Orchestrator Leadership**:
   - For non-trivial modifications, adopt the persona and workflow of [.ai/agents/orchestrator.md](../../.ai/agents/orchestrator.md).
   - Decompose tasks into subtasks matching specialized roles: `architect`, `core-developer`, `test-engineer`, `security-auditor`, `release-manager`.
   - Adhere strictly to [.ai/rules/orchestration-protocol.md](../../.ai/rules/orchestration-protocol.md).
2. **TypeScript & Engine Standards**:
   - Strict ESM (`NodeNext`): all relative imports must include `.js` extension.
   - Use `Number.parseInt(str, 10)` and `Number.parseFloat(str)` exclusively.
   - Zero `any` types; use Zod `safeParse`.
   - See [.ai/rules/typescript-standards.md](../../.ai/rules/typescript-standards.md).
3. **Security & Workflow Standards**:
   - Zero high/critical CVEs (`npm audit`).
   - Pin third-party GitHub Actions to 40-character commit SHAs.
   - See [.ai/rules/security-policies.md](../../.ai/rules/security-policies.md) and [.ai/rules/action-workflow-rules.md](../../.ai/rules/action-workflow-rules.md).
4. **Deterministic Verification**:
   - Verify deliverables using [.ai/skills/build-and-verify/SKILL.md](../../.ai/skills/build-and-verify/SKILL.md):
     `npm run typecheck && npm run lint && npm run test:coverage`
