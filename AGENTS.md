# 🤖 Universal AI Agent Entrypoint (`AGENTS.md`)

Welcome to the `review-pr-action` repository. This repository is governed by an **AI-Native Orchestrator-Subagent Framework**.

All AI agents (Cursor, Antigravity, GitHub Copilot, Windsurf, Claude Code, Kiro, Cline, etc.) operating in this codebase MUST follow the Single Source of Truth (SSOT) located in the [`.ai/`](.ai/README.md) directory.

---

## 🏛️ Architecture & Single Source of Truth (SSOT)

The `.ai/` directory provides complete instructions and governance across three pillars:

```text
.ai/
├── README.md                 # Master Architecture & SSOT Router
├── agents/                   # Orchestrator & Specialized Subagent Personas
│   ├── orchestrator.md       # Root Dispatcher & Verification Controller
│   ├── architect.md          # Schema & System Design
│   ├── core-developer.md     # Business Logic & Algorithms
│   ├── test-engineer.md      # Vitest Test Suites & Coverage Gate
│   ├── security-auditor.md   # Supply Chain & 40-char SHA Pinning
│   └── release-manager.md    # Marketplace Release & SemVer Tagging
├── rules/                    # Domain Standards (with YAML frontmatter)
│   ├── orchestration-protocol.md
│   ├── typescript-standards.md
│   ├── security-policies.md
│   ├── action-workflow-rules.md
│   └── git-workflow-rules.md
└── skills/                   # Actionable Verification & Execution Playbooks
    ├── build-and-verify/SKILL.md
    ├── impact-analysis/SKILL.md
    ├── test-generation/SKILL.md
    └── marketplace-release/SKILL.md
```

For full details, read [`.ai/README.md`](.ai/README.md).

---

## 👑 Mandatory Orchestration Model

1. **Orchestrator Leadership**:
   - Complex tasks MUST be managed by the [Orchestrator Agent](.ai/agents/orchestrator.md).
   - The Orchestrator analyzes the task, breaks it into atomic subtasks, issues explicit execution contracts, verifies deliverables against deterministic quality gates, and synthesizes results.
2. **Subtask Execution Contracts**:
   - Subagents operate only within their assigned `Allowed Target Files`.
   - Never cross subagent domains without a dedicated contract.
3. **Deterministic Quality Gates**:
   - No subtask is complete until the verification pipeline passes:
     ```bash
     npm run typecheck && npm run lint && npm run test:coverage
     ```

---

## 🛡️ Non-Negotiable Guardrails

- **Strict ESM (`NodeNext`)**: Relative imports must include the explicit `.js` extension.
- **Number Parsing**: Never use bare `parseInt()` or `parseFloat()`. Always use `Number.parseInt(val, 10)` or `Number.parseFloat(val)`.
- **Zero CVE Policy**: `npm audit` must return 0 high or critical vulnerabilities.
- **Workflow Security**: All third-party GitHub Actions must be pinned to 40-character commit SHAs.
- **Coverage Gate**: Test coverage must be $\ge 80\%$ on all metrics.
- **Distribution Hygiene**: Never track `dist/` on feature branches; `dist/index.js` is built and committed only for releases.

---

## 🔗 Quick Links
- [Master AI Architecture & Router](.ai/README.md)
- [Orchestration Protocol](.ai/rules/orchestration-protocol.md)
- [TypeScript Coding Standards](.ai/rules/typescript-standards.md)
- [Build & Verify Playbook](.ai/skills/build-and-verify/SKILL.md)
