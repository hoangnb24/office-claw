# Server-World User Override Controls (`bd-w3l`)

Last updated: 2026-02-14

## Scope

Implemented in:
- `apps/server-world/src/commandRouter.mjs`
- `apps/server-world/src/worldState.mjs`
- `apps/server-world/src/worldServer.mjs`

Commands covered:
- `reassign_task`
- `cancel_task`
- `pause_project`
- `resume_project`
- `rerun_task`

## Runtime Semantics

### `reassign_task`
- Allowed only when task status is `planned` or `blocked`.
- `in_progress`, `done`, and `cancelled` task reassign attempts are rejected.
- `expected_task_status` and `from_agent_id` (when provided) are optimistic concurrency checks.

### `cancel_task`
- Requires explicit `confirm: true`.
- Allowed for `planned`, `blocked`, and `in_progress`.
- Rejected for `done`/`cancelled` with deterministic `NOT_ALLOWED`.
- Cancelling a task also cancels linked open decisions for that task.

### `pause_project` / `resume_project`
- `pause_project` activates dispatch pause (`scope=dispatch_only`):
  - no new task starts for the paused project
  - already `in_progress` tasks continue
- `resume_project` clears pause state and restores normal dispatch.
- `expected_project_status` is enforced when provided.

### `rerun_task`
- Allowed only for source tasks in terminal states (`done` or `cancelled`).
- Creates a new `planned` task with deterministic id prefix `task_rerun_###`.
- Preserves provenance via `rerun_of_task_id` plus optional `rerun_reason` / `constraints_patch`.

## Deterministic Error Mapping

- `VALIDATION_FAILED`: malformed payload shape, missing required fields, unsupported mode/scope.
- `NOT_FOUND`: target task/project/source task does not exist.
- `CONFLICT`: expected state assertion mismatch.
- `NOT_ALLOWED`: disallowed lifecycle action (terminal re-cancel, in-progress reassign, rerun non-terminal task, dispatch while paused).

## Semantic Event Mapping

`worldServer` now emits audit-friendly semantic events for successful overrides:
- `reassign_task` -> `task_reassigned`
- `cancel_task` -> `task_cancelled`
- `pause_project` -> `project_paused`
- `resume_project` -> `project_resumed`
- `rerun_task` -> `tasks_created` (rerun metadata)

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
