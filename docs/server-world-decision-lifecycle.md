# Server-World Decision Lifecycle and Unblock Orchestration

Linked bead: `bd-3ux`

## Scope delivered

- Extended decision lifecycle handling in `apps/server-world/src/worldState.mjs`:
  - explicit open/resolved transition recording
  - per-decision runtime hooks with transition history
  - deterministic blocker linkage from decisions to tasks
- Implemented blocker propagation:
  - `request_changes` now ensures an open decision linked to the affected task
  - linked task transitions to `blocked`
  - assignee enters `SeekingUserDecision` base state (with review ceremony override)
- Implemented unblock resume behavior:
  - `resolve_decision` unblocks only tasks linked to that specific `decision_id`
  - blocked tasks resume deterministically:
    - prior `planned` tasks return to `planned`
    - assigned tasks resume as `in_progress`
  - assignee FSM state resumes to task-derived base state

## Persistence hooks (runtime)

Decision runtime metadata is maintained in-memory for deterministic orchestration and later persistence integration:

- transition sequence + transition history
- blocked task linkage set
- transition count

Debug/query helpers on world-state store:

- `getDecisionLifecycle(decision_id)`
- `getAllDecisionLifecycles()`

## Validation

- `apps/server-world/test/simulation.test.mjs` now validates:
  - open decision creation on `request_changes`
  - blocker propagation to `task_research`
  - seek-user behavior while blocked
  - unblock + resume behavior on `resolve_decision`
- Full checks:
  - `npm --prefix apps/server-world test`
  - `npm --prefix contracts run validate`
