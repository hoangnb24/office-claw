# Agent Navigation Guide

This guide is the fast path for coding agents to find the right files and commands without loading the full repository context.

## Quickstart

List available lookup topics:

```bash
node tools/agent-lookup.mjs --list
```

Search by intent:

```bash
node tools/agent-lookup.mjs --search offline
node tools/agent-lookup.mjs --search websocket
node tools/agent-lookup.mjs --search schema
```

Inspect one topic:

```bash
node tools/agent-lookup.mjs --topic server-world
```

Machine-readable output:

```bash
node tools/agent-lookup.mjs --topic qa-gates --json
```

## Source Files

- Lookup data: `docs/agent-lookup-map.json`
- Lookup CLI: `tools/agent-lookup.mjs`

## Local Instructions By Folder

When a local `AGENTS.md` exists, treat it as the first context file for work in that subtree.

- `apps/AGENTS.md`
- `apps/client-web/AGENTS.md`
- `apps/server-world/AGENTS.md`
- `contracts/AGENTS.md`
- `tools/AGENTS.md`
- `packages/AGENTS.md`
- `packages/openclaw-gateway/AGENTS.md`
- `packages/repository/AGENTS.md`
- `assets/AGENTS.md`
- `docs/AGENTS.md`

## Fast Path With ripgrep

```bash
rg --files apps/client-web/src
rg -n "submit_request|resolve_decision|approve_artifact" apps/client-web/src
rg -n "hello|subscribe|snapshot|ack|error" apps/server-world/src contracts
rg -n "scene-manifest|navigation|highlight_nodes" contracts assets/scenes docs
```
