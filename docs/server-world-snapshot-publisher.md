# Server-World Snapshot Publisher (bd-2s4)

`apps/server-world/src/worldServer.mjs` now includes a low-rate authoritative snapshot publisher for subscribed clients.

## Behavior

- Publish cadence is configurable and bounded to `2-5Hz` (default `3Hz`).
- Snapshot stream is sent only to sessions with:
  - completed `hello`
  - completed `subscribe`
  - `channels.snapshots = true`
- Each published snapshot is full-state (v0 baseline) and includes correction metadata:
  - `snapshot_seq`
  - `correction.mode = "ease"`
  - `correction.recommended_ease_ms`
  - `correction.hard_teleport_threshold_m`
  - `publisher.rate_hz`

## Runtime Introspection

- `/health` now reports snapshot publisher status and bounds.
- Server API now exposes:
  - `getSnapshotPublisherStats()`

## Validation Coverage

- `apps/server-world/test/worldServer.test.mjs`
  - low-rate periodic snapshot stream test
  - correction metadata assertions
  - publisher stats assertions

## Commands

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
