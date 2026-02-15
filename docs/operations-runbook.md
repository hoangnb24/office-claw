# Deployment, Incident Response, and Recovery Runbook (`bd-2i8`)

Last updated: 2026-02-14

## Scope

This runbook covers the current OfficeClaw local/pre-production operating model:
- startup and shutdown procedures
- incident triage flow
- recovery and rollback checklist

It is aligned to the current codebase (`apps/client-web`, `apps/server-world`, `contracts`) and existing health surfaces (`/health`, command security, restoration stats, observability dashboard).

## 1) Startup and Shutdown Procedures

### 1.1 Preflight checks

From repo root:

```bash
npm --prefix apps/client-web install
npm --prefix apps/server-world install
npm --prefix contracts install

npm --prefix contracts run validate
npm --prefix apps/server-world test
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```

If any command fails, do not continue startup until fixed.

### 1.2 Startup profiles

#### Profile A: Client-only loop (no server)

```bash
npm --prefix apps/client-web run dev
```

Use this for client-only validation, visual QA, and offline workflow iteration.

#### Profile B: Full local loop (server + client)

Terminal A (server):

```bash
node --input-type=module - <<'EOF'
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

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

await new Promise(() => {});
EOF
```

Terminal B (client):

```bash
VITE_WORLD_WS_URL=ws://127.0.0.1:8787/ws/world npm --prefix apps/client-web run dev
```

Health check:

```bash
curl -s http://127.0.0.1:8787/health | jq '{ok, error_dashboard: .error_dashboard.status, replay_resync, command_security, state_restoration}'
```

### 1.3 Shutdown procedure

1. Stop client (`Ctrl+C` in client terminal).
2. Stop server (`Ctrl+C` in server terminal).
3. Confirm service is down:

```bash
curl -sS http://127.0.0.1:8787/health
```

Expected result: connection failure.

4. If port is still bound, terminate remaining process:

```bash
lsof -iTCP:8787 -sTCP:LISTEN
```

## 2) Incident Triage Playbook

### 2.1 Severity levels

- `SEV-1`: Core loop unavailable (client cannot progress, server unavailable, or command processing blocked globally).
- `SEV-2`: Partial degradation (high validation/rate-limit errors, replay instability, UI panel failures with workaround).
- `SEV-3`: Minor degradation (non-critical UI artifacts, intermittent warnings, no data-loss risk).

### 2.2 First 5-minute triage checklist

1. Capture timestamp, operator, and current branch/commit.
2. Capture current `/health` payload.
3. Classify severity (`SEV-1/2/3`).
4. Determine blast radius:
   - client-only
   - server-only
   - protocol/contract mismatch
5. Choose response path from section 2.3.

### 2.3 Common incident paths

#### A) Client stuck reconnecting / no snapshots

Checks:

```bash
curl -s http://127.0.0.1:8787/health | jq '.ok, .simulation, .snapshot_publisher'
```

Actions:
1. Verify `VITE_WORLD_WS_URL` points to `ws://127.0.0.1:8787/ws/world`.
2. Restart server, then restart client.
3. If still failing, run contract and server validation (`contracts validate`, `server-world test`) before retry.

#### B) Commands return `NOT_ALLOWED` (restoration gate blocked)

Checks:

```bash
curl -s http://127.0.0.1:8787/health | jq '.state_restoration'
```

If `ready=false` or `consistency_ok=false`, use rollback procedure in section 3.

#### C) High `RATE_LIMITED` or `VALIDATION_FAILED` errors

Checks:

```bash
curl -s http://127.0.0.1:8787/health | jq '.command_security, .observability.command, .error_dashboard'
```

Actions:
1. Verify command payload shapes against `PROTOCOL.md` and contracts.
2. Reduce client command burst rate for local sessions.
3. Re-run `npm --prefix contracts run validate`.

#### D) Replay/resync anomalies

Checks:

```bash
curl -s http://127.0.0.1:8787/health | jq '.replay_resync'
```

Actions:
1. Restart client to force clean handshake.
2. If replay fallback loops, restart server and inspect event/journal files in `reports/runtime/`.

## 3) Recovery and Rollback Checklist

### 3.1 Soft recovery (no rollback)

1. Restart server.
2. Verify `/health` is `ok=true` and `error_dashboard.status` is `healthy` or expected.
3. Restart client and verify snapshot/event flow resumes.

### 3.2 Rollback for corrupted runtime journals/logs

1. Stop server.
2. Create backups:

```bash
mkdir -p reports/runtime/backups
ts="$(date +%Y%m%d-%H%M%S)"
cp reports/runtime/commands.jsonl "reports/runtime/backups/commands.${ts}.jsonl" 2>/dev/null || true
cp reports/runtime/events.jsonl "reports/runtime/backups/events.${ts}.jsonl" 2>/dev/null || true
```

3. Quarantine active files:

```bash
mv reports/runtime/commands.jsonl "reports/runtime/commands.corrupt.${ts}.jsonl" 2>/dev/null || true
mv reports/runtime/events.jsonl "reports/runtime/events.corrupt.${ts}.jsonl" 2>/dev/null || true
```

4. Restart server with clean runtime files (section 1.2, Profile B).
5. Verify:
   - `/health.ok == true`
   - `.state_restoration.consistency_ok == true`
   - command ack path returns `status=ok` for a safe test command
6. Restart client and validate normal loop behavior.

### 3.3 Post-incident closeout

1. Record trigger, impact window, and remediation in team thread.
2. Add follow-up bead(s) for permanent fixes if needed.
3. Attach relevant `/health` snapshots and validation command outputs.

## 4) Validation Evidence for This Runbook

The following commands were executed while preparing this runbook:

```bash
node --input-type=module -e "import { createWorldServer } from './apps/server-world/src/index.mjs'; const server = createWorldServer({ host: '127.0.0.1', port: 8787 }); const info = await server.start(); console.log('started', info.host, info.port); await server.stop(); console.log('stopped');"

node --input-type=module -e "import http from 'node:http'; import { createWorldServer } from './apps/server-world/src/index.mjs'; const server = createWorldServer({ host: '127.0.0.1', port: 8787 }); await server.start(); const body = await new Promise((resolve, reject) => { http.get('http://127.0.0.1:8787/health', (res) => { let data=''; res.on('data', (c)=> data += c); res.on('end', ()=> resolve(data)); }).on('error', reject); }); const json = JSON.parse(body); console.log('health_ok', json.ok, 'status', json.error_dashboard.status); await server.stop();"
```
