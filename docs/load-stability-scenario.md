# 5-Agent Concurrent Load Scenario

Related bead: `bd-1ul`

## Purpose
Provide a repeatable local load/stability scenario that exercises concurrent WebSocket sessions, command throughput, event fanout, and snapshot publishing.

## Harness
- Script: `tools/load/concurrent-load-scenario.mjs`
- Output artifact: `reports/load-stability-summary.json` (JSON summary)

## Workload Shape
- Starts an in-process world server (`createWorldServer`) at:
  - `tickRateHz=20`
  - `snapshotRateHz=5`
- Opens `N` concurrent WebSocket sessions (`hello -> subscribe`), default `N=5`.
- Per client, executes a deterministic command sequence:
  1. `submit_request`
  2. `assign_task` (`task_copy`)
  3. `start_kickoff` (`proj_abc`)
  4. `request_changes` (`art_research_report_v1`)
  5. `resolve_decision` (`dec_audience`)
  6. `auto_assign` (`proj_abc`)
- Sends `ping` envelopes during command phases to verify heartbeat responsiveness.
- Waits for settle window (`--settle-ms`, default 3000ms), then captures `/health`.

## Run Command
```bash
node tools/load/concurrent-load-scenario.mjs --clients 5 --settle-ms 3000 --out reports/load-stability-summary.json
```

## Captured Evidence
The summary JSON includes:
- aggregate client metrics (`commands_sent`, `ack`, `error`, `events`, `snapshots`, `pings/pongs`)
- per-client breakdown with `errors_by_code`
- `/health` snapshots for:
  - `command_security`
  - `observability`
  - `error_dashboard`
  - `simulation` (tick timing, queue latency, openclaw run counters)

## Notes
- This scenario intentionally includes concurrent `resolve_decision` calls, which can produce expected `CONFLICT` responses after the first successful resolution.
- It is designed for repeatability and bottleneck detection, not strict zero-error operation.
