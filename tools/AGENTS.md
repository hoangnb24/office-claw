# AGENTS.md (tools)

Scope: `tools/**`

## Start Here

- QA orchestrator: `tools/qa/run-qa-gates.mjs`
- Offline/live parity guard: `tools/qa/check-offline-live-parity.mjs`
- Runtime asset sync and drift check: `tools/sync-runtime-assets.mjs`
- Asset provenance gate: `tools/asset-provenance-ledger.mjs`
- GLB/scene validation: `tools/glb-preflight.mjs`, `tools/nav-preflight.mjs`
- Agent lookup: `tools/agent-lookup.mjs`
- Beads claim hook installer: `tools/install-br-cass-hook.sh`
- Beads claim preflight wrapper: `tools/br-update-with-cass.sh`

## Conventions

- Keep scripts deterministic and CLI-first.
- Prefer explicit flags for output paths and check-only modes.
- Do not introduce interactive flows in agent automation paths.

## High-Value Commands

```bash
node tools/qa/run-qa-gates.mjs
node tools/qa/run-qa-gates.mjs --only parity
node tools/sync-runtime-assets.mjs --check
node tools/agent-lookup.mjs --list
```
