# `bd-m9rj` First-Run Microcopy State Alignment

## Summary

Aligned first-run Inbox/Task Board/Decisions microcopy so user-facing status text tracks live kickoff and blocker transitions instead of sticking on stale submission copy.

## Delivered

1. `apps/client-web/src/network/inboxCommands.ts`
   - Updated submit success copy to: `Request submitted. Awaiting kickoff confirmation.`
   - Fixed sequencing by setting the pending notice before command dispatch, so later command/event updates are not overwritten by the submit handler.

2. `apps/client-web/src/network/useWorldSocket.ts`
   - Added submit-request ACK guard so ACK microcopy does not regress an already-advanced Inbox notice state (`Kickoff started...` / `Initial tasks created...`).
   - Existing event-driven notice transitions remain active for connected socket runtime.

3. `apps/client-web/src/offline/mockWorldRuntime.ts`
   - Added offline parity notice lifecycle in `appendOfflineEvent(...)`:
     - `kickoff_started` (submit flow): Inbox notice set to kickoff-in-progress copy.
     - `tasks_created` (submit flow): Inbox notice set to task-created copy and Task Board opened.
     - `decision_requested` / `task_blocked`: Task Board + Decisions notices set with blocked-flow-specific guidance and Decisions panel opened.
     - `decision_requested`: upserts decision entries so panel no longer stays in generic empty state.
     - `decision_resolved`: resolves decision entry and posts success notice.

## Validation

1. `npm --prefix apps/client-web run typecheck` ✅
2. `npm --prefix apps/client-web run build` ✅
3. `agent-browser` local walkthrough on `http://127.0.0.1:4173` ✅
   - Submit request from Inbox.
   - Confirmed Inbox transitioned to `Initial tasks created. Review assignments in Task Board.` after kickoff/task creation events.
   - Confirmed Task Board notice showed blocked context (`task_offline_copy blocked by dec_offline_scope.`).
   - Confirmed Decisions panel opened with specific unblock guidance (`task_offline_copy needs dec_offline_scope...`) and a populated open decision record.

## Evidence

- Screenshot: `reports/client-polish/microcopy-m9rj/20260215T133519Z/first-run-state-transition.png`
