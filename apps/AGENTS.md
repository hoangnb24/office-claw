# AGENTS.md (apps)

Scope: `apps/**`

## Routing

- For client work, start at `apps/client-web/AGENTS.md`.
- For server work, start at `apps/server-world/AGENTS.md`.
- If a change crosses both folders, validate both workspaces before completion.

## Cross-App Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/server-world test
node tools/qa/check-offline-live-parity.mjs
```

## Shared Runtime Boundary

- Server remains authoritative for world state and simulation.
- Client remains authoritative for rendering and interaction UX.
