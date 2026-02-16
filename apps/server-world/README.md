# server-world

Authoritative world transport service for OfficeClaw protocol bootstrap and simulation over `/ws/world`.

## Runtime Entry Points

- Public exports: `apps/server-world/src/index.mjs`
- Main server runtime: `apps/server-world/src/worldServer.mjs`
- Command routing: `apps/server-world/src/commandRouter.mjs`
- Snapshot/state orchestration: `apps/server-world/src/worldState.mjs`
- Simulation clock/tick loop: `apps/server-world/src/simulation.mjs`

## Implemented Behavior

- WebSocket endpoint: `/ws/world`
- `hello` validation and `hello_ack` bootstrap
- `subscribe` validation with initial authoritative `snapshot`
- `ping` / `pong` heartbeat echo
- Command dispatch with deterministic terminal `ack` or `error` (`in_reply_to` correlation)
- Authoritative simulation loop with bounded tick-rate config (`10-20Hz`)
- Snapshot publisher with bounded broadcast rate (`2-5Hz`)
- Semantic event timeline with monotonic sequence and replay cursor support
- Request/task/decision/artifact lifecycle orchestration
- Scene-manifest nav grid loading with server-side pathfinding and occupancy checks
- Reconnect/resync handling with replay-then-snapshot fallback
- Privacy/export guardrails and restoration consistency checks in `/health`

## Scripts

```bash
npm --prefix apps/server-world test
```

## Local Server Launch

```bash
node --input-type=module - <<'EOF_SERVER'
import { createWorldServer } from "./apps/server-world/src/index.mjs";

const server = createWorldServer({
  host: "127.0.0.1",
  port: 8787,
  commandJournalPath: "./reports/runtime/commands.jsonl",
  eventLogPath: "./reports/runtime/events.jsonl"
});

const info = await server.start();
console.log(`[server-world] ws://${info.host}:${info.port}/ws/world`);
console.log("[server-world] health: http://127.0.0.1:8787/health");

await new Promise(() => {});
EOF_SERVER
```
