# Load Stability Report (5 Concurrent Clients)

Related bead: `bd-1ul`  
Run date: `2026-02-14`  
Scenario reference: `docs/load-stability-scenario.md`

## Executed Command
```bash
node tools/load/concurrent-load-scenario.mjs --clients 5 --settle-ms 3000 --out reports/load-stability-summary.json
```

## Aggregate Results
- clients: `5`
- commands sent: `30`
- command terminal outcomes:
  - ack: `26`
  - error: `4` (`CONFLICT` only)
- events delivered: `155`
- snapshots delivered: `240`
- heartbeats:
  - ping sent: `40`
  - pong received: `40`

## Server Health Signals (`/health`)
- command pipeline:
  - attempted: `30`
  - ok: `26`
  - failed: `4`
  - rate_limited: `0`
  - blocked_by_restoration: `0`
- observability:
  - alerts_emitted: `0`
  - error_dashboard.status: `healthy`
  - errors_by_code: `{ "CONFLICT": 4 }`
- simulation:
  - tick_count: `185`
  - tick_timing_ms: `avg=0.24`, `p95=1`, `max=6`
  - queue_latency_ms.commands/events: all `0`
  - openclaw_runs: `{ total: 2, active: 2, by_status: { started: 2 } }`

## Bottlenecks and Findings
1. Concurrent decision resolution contention
- Evidence: 4 `CONFLICT` errors (`decision is not open`) from parallel `resolve_decision` requests after first winner.
- Impact: expected under contention but noisy for users/automation if retries are not guarded.

2. High snapshot fanout under multi-session load
- Evidence: 240 snapshots in a short run window with 5 subscribed sessions.
- Impact: acceptable in this run (no alerts), but likely primary bandwidth/cost driver at larger client counts.

3. Observability gap for command/event queue latency in this path
- Evidence: `queue_latency_ms.commands/events` remained `0` while command/event traffic was non-trivial.
- Impact: current metric path does not expose end-to-end command handling latency for websocket command flow.

4. Long-lived OpenClaw run states without completion signal in stress loop
- Evidence: `openclaw_runs.active=2` and status remains `started` at capture time.
- Impact: without explicit completion/failure callbacks, active run counts can remain elevated and obscure real workload saturation.

## Prioritized Mitigation Follow-Ups
1. Add deterministic client/server guardrail for `resolve_decision` contention
- Suggestion: idempotent resolve handling + stale-decision UX recovery path to reduce expected `CONFLICT` noise.

2. Add tunable snapshot publish strategy for larger concurrency
- Suggestion: adaptive snapshot cadence and/or per-session throttling under load while preserving correction guarantees.

3. Add command-path latency instrumentation for websocket handlers
- Suggestion: explicit timing metrics from command receipt -> router -> ack/error emit, surfaced in `/health`.

4. Add OpenClaw run watchdog/timeout state transitions
- Suggestion: automatic transition to failed/cancelled for stale `started/running` runs without status callbacks.

## Evidence Artifacts
- JSON run output: `reports/load-stability-summary.json`
- Harness script: `tools/load/concurrent-load-scenario.mjs`
