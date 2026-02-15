# Reconnect/Resync Test Matrix (bd-2of)

This matrix validates the extension defined in `PROTOCOL.md` section `9) Reconnect/Resync Extension (v1-compatible)`.

## Cases

1. Resume success (`status=resumed`)
- Precondition: replay log contains all entries after client `last_seq`.
- Expectation: server replays from `replay_from_seq` and emits a fresh snapshot checkpoint.

2. Stale cursor fallback (`reason=CURSOR_STALE`)
- Precondition: client `last_seq` is below retention floor.
- Expectation: server returns `snapshot_required`; client receives full snapshot and clears stale delta assumptions.

3. Unknown cursor fallback (`reason=CURSOR_UNKNOWN`)
- Precondition: client `last_seq` is invalid for current session history.
- Expectation: snapshot fallback path, no replay attempt.

4. Replay unavailable fallback (`reason=REPLAY_UNAVAILABLE`)
- Precondition: replay subsystem degraded.
- Expectation: deterministic snapshot fallback and observability event `resync_fallback_snapshot`.

5. Legacy client compatibility
- Precondition: client sends baseline `hello` without `resume`.
- Expectation: server continues v1 handshake and initial snapshot behavior unchanged.

## Observability

- Track reconnect attempts and terminal outcome (`resumed` vs `snapshot_required` vs `unsupported`).
- Emit `resync_fallback_snapshot` event with reason to support incident triage and UX tuning.
