# Task Board Command Plumbing

Related bead: `bd-1sr`

## What was added
- `apps/client-web/src/network/taskBoardCommands.ts`
  - `dispatchAssignTask(taskId, agentId)`
  - `dispatchAutoAssign(projectId)`
  - deterministic error-to-microcopy mapping (`taskBoardErrorMicrocopy`)
- `apps/client-web/src/network/worldSocketBridge.ts`
  - active socket client bridge for command dispatch
- `apps/client-web/src/network/worldSocketClient.ts`
  - `sendCommand(name, data)` support
  - command ack/error correlation via `in_reply_to`
  - `onCommandResult` callback surface
- `apps/client-web/src/network/useWorldSocket.ts`
  - task-board ack/error notices wired to UI store
- `apps/client-web/src/state/uiStore.ts`
  - `taskBoardNotice` state (`success`/`error`) and setter

## Behavior
- Task-board commands are dispatched over active world socket as protocol `command` envelopes.
- `ack` for `assign_task`/`auto_assign` sets success notice.
- `error` maps server error code to actionable UI copy:
  - `VALIDATION_FAILED`
  - `NOT_FOUND`
  - `CONFLICT`
  - `NOT_ALLOWED`
  - `RATE_LIMITED`
  - `INTERNAL`

## Edge handling
- No active socket: immediate local error notice.
- Failed send path: immediate local error notice.
- Unknown command error code: falls back to server message or generic retry text.

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
