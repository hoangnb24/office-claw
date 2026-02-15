# OpenClaw Collaboration Hooks (`bd-2vm`)

## Scope
- Provide a wrapper for BD -> specialist consult patterns via OpenClaw session tools.
- Enforce consult policy constraints before issuing consult requests.
- Emit traceable consult metadata suitable for event timelines/audit fields.

## Package updates
- `packages/openclaw-gateway/src/sessionCollaboration.mjs`
  - `createSessionCollaborationHooks({ gatewayClient, policy })`
    - `requestConsult(...)`
    - `requestConsultHistory(...)`
  - `CollaborationPolicyError` with explicit policy failure codes.
  - `buildConsultEventMetadata(...)` for deterministic trace fields.
- `packages/openclaw-gateway/src/index.mjs`
  - exports collaboration hooks + policy error + metadata helper.

## Policy constraints
Default policy:
- requester allowlist: `agent_bd`
- specialist allowlist: `agent_research_1`, `agent_eng_1`, `agent_ops_1`
- self-consult disabled
- urgency allowlist: `low | normal | high`

Rejected requests throw `CollaborationPolicyError` with codes such as:
- `REQUESTER_NOT_ALLOWED`
- `SPECIALIST_NOT_ALLOWED`
- `SELF_CONSULT_BLOCKED`
- `URGENCY_NOT_ALLOWED`

## Traceability metadata
Each consult emits trace metadata containing:
- `consult_id`
- requester/specialist agent ids
- requester/specialist session keys
- `project_id`
- parent task/event linkage
- urgency + policy version
- status (`requested`, `history_requested`, etc.)

This metadata is intended for server event payload `meta` fields.

## Validation
- `npm --prefix packages/openclaw-gateway test`

---

## Server Runtime Hooks (`bd-3sn`)

### Scope
- Trigger OpenClaw run lifecycle when an assignee reaches `WorkingAtPOI` on an `in_progress` task.
- Accept deterministic run status callbacks and map them into task lifecycle updates.
- Enforce cancellation/interrupt behavior when override controls cancel or block work.

### Implemented in
- `apps/server-world/src/worldState.mjs`
- `apps/server-world/src/simulation.mjs`
- `apps/server-world/test/simulation.test.mjs`

### Runtime behavior
- Run start trigger:
  - On tick progression, if agent effective state is `WorkingAtPOI` and task is `in_progress`, a run is created:
    - `run_id`: `run_oc_####`
    - `status`: `started`
    - linked keys: `project_id`, `task_id`, `agent_id`
- Status callback event:
  - `applyEvent({ name: "openclaw_run_status", task_id|run_id, status })`
  - accepted statuses: `started | running | completed | failed | cancelled`
- Lifecycle effects:
  - `running` -> task runtime transition marker (`openclaw_running`)
  - `completed` -> task completion (`done`)
  - `failed` -> task transitions to `blocked` and assignee moves to `BlockedWaiting`
- Interrupt semantics:
  - `cancel_task` marks active run `cancelled`
  - decision-driven blocking (`request_changes` path) interrupts active run as `cancelled`

### Lifecycle observability
- `worldState` now exposes:
  - `getOpenClawRun(taskId)`
  - `getAllOpenClawRuns()`
- `simulation.getStats()` now includes:
  - `openclaw_runs.total`
  - `openclaw_runs.active`
  - `openclaw_runs.by_status`

### Validation
- `npm --prefix apps/server-world test`
