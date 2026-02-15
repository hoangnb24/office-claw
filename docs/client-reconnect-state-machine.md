# Client Reconnect State Machine (bd-361)

`apps/client-web/src/network/worldSocketClient.ts` implements reconnect/resume behavior aligned with `PROTOCOL.md` section 9.

## State progression

- `connecting` -> `connected`
- transient failure: `connected` -> `stale` -> `reconnecting`
- terminal/manual stop: `disconnected`
- transport error edge: `error` then retry path

## Backoff policy

- attempt 1: 1s
- attempt 2: 2s
- attempt 3: 4s
- attempt 4+: 8s + jitter (0-500ms)

## Resume and resubscribe behavior

On reconnect open:
1. client sends `hello` with `resume.last_seq` and `resume.last_snapshot_id`
2. on `hello_ack`, client sends `subscribe`
3. snapshot/event `seq` values update resume cursor for next recovery

## UX surfacing

`OverlayRoot` exposes:
- current connection status
- reconnect attempt count
- user-facing recovery hints
- last transport error
- current resume cursor (`lastSeq`, `lastSnapshotId`)

## Integration scenario checks

1. Start with no server running: client enters reconnect loop with visible stale/recovering states.
2. Bring server up during retries: client transitions to `connected` without page reload.
3. Drop server after connected: client returns to stale/reconnecting path and keeps last rendered world state.
