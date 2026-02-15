# Server-World Reconnect/Resync (bd-3v9)

`apps/server-world/src/worldServer.mjs` now supports resume-from-cursor reconnect handling with deterministic fallback behavior.

## Resume Flow

- Client may send `hello.payload.resume.last_seq`.
- Server evaluates cursor against bounded replay buffer and returns `hello_ack.payload.resume`:
  - `status: "resumed"` with `replay_from_seq`
  - or `status: "snapshot_required"` with fallback reason

Fallback reasons currently emitted:

- `CURSOR_STALE`
- `CURSOR_UNKNOWN`
- `SERVER_RESTARTED`

## Replay + Snapshot Behavior

- Replay buffer is keyed by monotonic event sequence.
- On subscribe:
  - authoritative snapshot is sent
  - if resume is valid and bounded replay is available, replay events are delivered from cursor
  - otherwise snapshot-only fallback is used

## Bounded Buffer Controls

- `eventBufferSize` controls retained replay window.
- `replayLimit` controls max replayed events per resume request.

## Observability

- `/health` includes `replay_resync` stats:
  - `resume_attempts`
  - `resume_success`
  - `resume_fallback`
  - `replayed_events`
  - `fallback_reasons`
  - replay/buffer bounds

- Server accessor: `getReplayResyncStats()`

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
