# Milestone M3 Gate Validation

Related bead: `bd-3ka`  
Date: `2026-02-14`

## Gate intent (PLAN.md M3)

- server-driven NPC movement loop end-to-end
- reconnect/resync behavior with bounded replay
- client-side path/goal playback plus reconciliation

## Dependency Closure

- `bd-gtq` (C1 client-only core gate): closed
- `bd-3mh` (M2 movement gate): closed
- `bd-361` (client reconnect state machine): closed
- `bd-3v9` (server reconnect/resync with replay): closed
- `bd-3r0` (snapshot reconciliation): closed
- `bd-7jc` (agent goal/path playback): closed
- `bd-1ce` (deterministic server agent FSM): closed
- `bd-2re` (ws bootstrap/lifecycle): closed

## Criteria Check

1. Dependencies complete and aligned to M3 intent.
   - Verified by dependency closure and linked implementation docs listed below.
2. End-to-end demo path works without manual state patching.
   - Server publishes snapshots/events and supports resume/fallback:
     - `docs/server-world-ws-lifecycle.md`
     - `docs/server-world-reconnect-resync.md`
     - `docs/server-world-event-replay.md`
   - Client consumes server goals and reconciles with thresholded corrections:
     - `docs/client-agent-goal-playback.md`
     - `docs/client-snapshot-reconciliation.md`
   - Reconnect behavior and stale-state UX path exist:
     - `docs/client-reconnect-state-machine.md`
3. Known limitations captured.
   - Broader cross-surface E2E automation remains tracked (`bd-2fr`).
   - Runtime performance thresholds/tuning remains tracked (`bd-2k5`).

## Validation Signals

- server suite: `npm --prefix apps/server-world test` (passing in latest dependency closeouts)
- contracts suite: `npm --prefix contracts run validate` (passing in latest dependency closeouts)
- client suite: `npm --prefix apps/client-web run typecheck` / `build` in related dependency closures

## Gate Decision

`M3` is **validated** for server-driven NPC movement readiness.  
`M4` event/highlight progression can proceed on top of this baseline.
