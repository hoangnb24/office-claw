# USER_OVERRIDE_CONTROLS.md

Last updated: 2026-02-14
Related bead: `bd-put`

## Purpose
Define user override controls for OfficeClaw with clear scope by release phase, protocol command proposals, and state-transition safety constraints that keep world state consistent.

## Decision Memo: v0 vs v0.2

### v0 (ship now)
- `reassign_task`: change assignee for `planned` and `blocked` tasks.
- `cancel_task`: cancel `planned`, `blocked`, or `in_progress` tasks with confirmation.
- `pause_project` / `resume_project`: temporarily stop/start new task dispatch at project level.

### v0.2 (defer)
- `pause_task` / `resume_task`: per-task pause semantics during active execution.
- `rerun_task`: clone and rerun completed/cancelled work with explicit provenance.
- Bulk operations (pause/cancel/reassign many tasks at once).

### Rationale
- v0 keeps controls understandable and safe while avoiding high-risk mid-step interruption semantics.
- v0.2 features require stronger runtime guarantees (checkpointing, resumability, and replay-safe behavior).

## Proposed Commands (Protocol Additions)

All commands follow the existing envelope with `type=command` and return `ack`/`error` using `in_reply_to`.

### `reassign_task` (v0)
```json
{
  "name": "reassign_task",
  "data": {
    "task_id": "task_1",
    "from_agent_id": "agent_research_1",
    "to_agent_id": "agent_eng_1",
    "reason": "skill_match",
    "expected_task_status": "blocked"
  }
}
```

### `cancel_task` (v0)
```json
{
  "name": "cancel_task",
  "data": {
    "task_id": "task_2",
    "reason": "scope_changed",
    "confirm": true,
    "expected_task_status": "in_progress"
  }
}
```

### `pause_project` (v0)
```json
{
  "name": "pause_project",
  "data": {
    "project_id": "proj_abc",
    "reason": "awaiting_direction",
    "scope": "dispatch_only"
  }
}
```

### `resume_project` (v0)
```json
{
  "name": "resume_project",
  "data": {
    "project_id": "proj_abc",
    "reason": "decision_resolved"
  }
}
```

### `rerun_task` (v0.2)
```json
{
  "name": "rerun_task",
  "data": {
    "source_task_id": "task_9",
    "mode": "clone_as_new",
    "reason": "new_constraints",
    "constraints_patch": {"tone":"shorter"}
  }
}
```

## State-Transition Implications

### Task lifecycle impact
- Existing canonical statuses: `planned | in_progress | blocked | done | cancelled`.
- `reassign_task`:
  - allowed in `planned` or `blocked`
  - disallowed in `done` or `cancelled`
  - for `in_progress`, disallow in v0 (requires pause/checkpoint semantics)
- `cancel_task`:
  - allowed in `planned`, `blocked`, `in_progress`
  - transition target is always `cancelled` (terminal)
- `rerun_task` (v0.2):
  - does not reopen old task
  - creates a new task (`planned`) with provenance reference to source task

### Project lifecycle impact
- `pause_project` maps `project.status` to `blocked` (or equivalent paused semantic alias).
- While paused:
  - no new task starts
  - in-progress tasks may continue in v0 if `scope=dispatch_only`
- `resume_project` transitions `blocked -> executing` when preconditions are satisfied.

### Artifact/decision implications
- Cancelling an in-progress task must not silently delete existing artifact versions.
- If a cancelled task has open decisions, unresolved decisions transition to `cancelled`.
- Rerun creates new artifact lineage; prior approved artifacts remain immutable.

## Safety Constraints (Consistency Guards)

### Preconditions and optimistic safety
- Every override command should include current-state assertions (`expected_task_status` or project revision).
- Server rejects stale commands with `CONFLICT`.

### Single-writer command ordering
- Process commands sequentially per `project_id` to avoid race-induced illegal transitions.
- Emit deterministic event order for override operations (request -> accepted/rejected -> resulting state event).

### Idempotency
- Commands must support idempotency key handling so retries do not apply side effects twice.
- Duplicate command with same idempotency key returns same `ack` payload.

### Authorization and intent safety
- Override commands must require explicit user intent (especially `cancel_task` and future bulk actions).
- Destructive controls require confirmation UI and clear consequences in copy.

### Invariant checks before commit
- Validate IDs against canonical patterns from `DOMAIN_MODEL.md`.
- Enforce lifecycle guards before writing state.
- Reject unknown or terminal-state operations with deterministic errors.

## Normalized Error Mapping for Overrides

| Error code | Override scenario | Required user-facing behavior |
|---|---|---|
| `VALIDATION_FAILED` | missing `task_id` / malformed payload | highlight fields and keep input |
| `NOT_FOUND` | task/project not found | refresh panel and clear stale selection |
| `CONFLICT` | stale expected status / concurrent update | fetch latest snapshot and retry |
| `NOT_ALLOWED` | command on terminal state / unauthorized action | explain why action is blocked |
| `RATE_LIMITED` | repeated override attempts | show cooldown and retry guidance |
| `INTERNAL` | unexpected server fault | preserve intent and provide safe retry |

## QA/Validation Plan

### Required checks
- Positive:
  - reassign `blocked` task succeeds and emits assignment event + updated snapshot
  - cancel `planned` task succeeds and transitions to `cancelled`
  - pause/resume project toggles dispatch behavior as defined
- Negative:
  - reassign `done` task fails with `NOT_ALLOWED`
  - cancel already `cancelled` task fails deterministically
  - stale expected status fails with `CONFLICT`
  - malformed IDs fail with `VALIDATION_FAILED`

### Evidence requirements
- Protocol fixture examples added/updated for each v0 override command.
- Test results capture both `ack` and `error` correlation (`in_reply_to`).
- Validation output is reproducible from a single documented command/test entrypoint.

## Implementation Checklist
- v0 command contracts agreed and added to command taxonomy docs/schemas.
- Lifecycle guards implemented at command handler boundary.
- UI confirmation and recovery copy added for destructive operations.
- v0.2 backlog items tracked explicitly (`pause_task`, `rerun_task`, bulk operations).
