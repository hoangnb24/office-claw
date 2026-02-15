# Client Offline Mock World Mode (bd-2gd)

`apps/client-web` now supports a deterministic offline runtime profile so the core loop can boot without server/OpenClaw connectivity.

## Runtime Flag

- Enable offline mode:
  - `VITE_OFFLINE_MOCK_WORLD=1`
- Existing WebSocket auto-connect flag (`VITE_WORLD_WS_AUTO_CONNECT`) is bypassed when offline mode is enabled.

## Behavior

- Client boots as `connected` with local deterministic world state.
- Mock runtime seeds:
  - agents
  - tasks
  - event timeline entries
  - agent goals/path intents
- Synthetic ticks update agent/task state at fixed cadence and append repeatable semantic events.

## Implementation

- `apps/client-web/src/config/runtimeProfile.ts`
  - runtime profile helpers
- `apps/client-web/src/offline/mockWorldRuntime.ts`
  - deterministic offline world producer
- `apps/client-web/src/network/useWorldSocket.ts`
  - switches between live socket client and offline mock runtime
- `apps/client-web/src/state/worldStore.ts`
  - `bootstrapOfflineState(...)` to atomically seed/replace deterministic snapshot state
- `apps/client-web/src/App.tsx`
  - runtime profile attribute (`data-runtime-profile`)

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```
