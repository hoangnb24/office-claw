# Server-World Observability Baseline (bd-1jg)

`apps/server-world/src/worldServer.mjs` now exposes a baseline observability surface for server runtime health, protocol diagnostics, and alert hooks.

## Structured Runtime Signals

- Protocol counters:
  - `inbound_messages` by type
  - `outbound_messages` by type
- Command pipeline metrics:
  - `attempted`
  - `ok`
  - `failed`
  - `rate_limited`
  - `blocked_by_restoration`
- Session/lifecycle metrics:
  - `connected`
  - `disconnected`
  - `socket_errors`
- Publish pipeline metrics:
  - `snapshots_published`
  - `events_published`

## Error Dashboard + Alert Hooks

- `getErrorDashboard()` returns:
  - `status` in `{healthy, warning, critical}`
  - active alert list
  - last error summary
- Threshold-based alert hooks:
  - configurable via `observabilityAlertThresholds`
  - callback via `observabilityAlertHandler(alert)`
- Default threshold families:
  - `validation_failed`
  - `rate_limited`
  - `socket_errors`
  - `restoration_blocked`
  - `slow_tick_ms`
  - `queue_latency_ms`

## Health Endpoint Integration

- `/health` now includes:
  - `observability`
  - `error_dashboard`
  - existing simulation/snapshot/replay/security/restoration sections

## Server Accessors

- `getObservabilityStats()`
- `getErrorDashboard()`
- Existing:
  - `getCommandSecurityStats()`
  - `getReplayResyncStats()`
  - `getStateRestorationStats()`

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
