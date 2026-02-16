# AGENTS.md (apps/server-world)

Scope: `apps/server-world/**`

## Runtime Authority

Authoritative server runtime modules are `.mjs` files:

- `apps/server-world/src/worldServer.mjs`
- `apps/server-world/src/commandRouter.mjs`
- `apps/server-world/src/worldState.mjs`
- `apps/server-world/src/simulation.mjs`

## Start Here

- Exports: `apps/server-world/src/index.mjs`
- Protocol lifecycle and envelope flow: `apps/server-world/src/worldServer.mjs`
- Command validation and mutation paths: `apps/server-world/src/commandRouter.mjs`
- Snapshot/state invariants: `apps/server-world/src/worldState.mjs`

## Commands

```bash
npm --prefix apps/server-world test
```

## Local Launch

```bash
node --input-type=module -e "import { createWorldServer } from './apps/server-world/src/index.mjs'; console.log(typeof createWorldServer);"
```

## Required Validation

- For protocol/command/state changes:
  - `npm --prefix apps/server-world test`
  - `npm --prefix contracts run validate`
