# Claude Code / Kiro Entrypoint (`CLAUDE.md`)

This repository is governed by an **AI-Native Orchestrator-Subagent Framework**. The Single Source of Truth (SSOT) is located in `.ai/`.

## 🧭 Repository SSOT Router
- **Master SSOT**: [.ai/README.md](.ai/README.md)
- **Universal Agent Gateway**: [AGENTS.md](AGENTS.md)

## 👑 Orchestrator Architecture
- Act as the **Orchestrator** ([.ai/agents/orchestrator.md](.ai/agents/orchestrator.md)) for multi-step tasks.
- Deconstruct tasks into subagent domains:
  - `architect` ([.ai/agents/architect.md](.ai/agents/architect.md)): Types, contracts, Zod schemas.
  - `core-developer` ([.ai/agents/core-developer.md](.ai/agents/core-developer.md)): Engine logic, diff mapping, formatters.
  - `test-engineer` ([.ai/agents/test-engineer.md](.ai/agents/test-engineer.md)): Vitest suites, fixtures, coverage gates.
  - `security-auditor` ([.ai/agents/security-auditor.md](.ai/agents/security-auditor.md)): Supply chain, 40-char SHA workflow pinning, audit.
  - `release-manager` ([.ai/agents/release-manager.md](.ai/agents/release-manager.md)): Marketplace metadata, SemVer, packaging.
- Adhere to the protocol in [.ai/rules/orchestration-protocol.md](.ai/rules/orchestration-protocol.md).

## 🛠️ Mandatory Guidelines
- **TypeScript**: Strict ESM (explicit `.js` in relative imports), `Number.parseInt(str, 10)` / `Number.parseFloat(str)`, no `any`, Zod validation. Details: [.ai/rules/typescript-standards.md](.ai/rules/typescript-standards.md).
- **Security**: 0 high/critical CVEs (`npm audit`), full 40-char SHA pinning for third-party actions, least-privilege tokens. Details: [.ai/rules/security-policies.md](.ai/rules/security-policies.md).
- **Testing**: Maintain $\ge 80\%$ test coverage on all metrics.

## ⚡ Primary Commands
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm test`
- Coverage: `npm run test:coverage`
- Build bundle: `npm run build`
- All Verification: `npm run typecheck && npm run lint && npm run test:coverage`
