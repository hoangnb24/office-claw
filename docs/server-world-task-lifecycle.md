# Server-World Task Lifecycle Orchestration (bd-sli)

`apps/server-world/src/worldState.mjs` now contains deterministic project/task lifecycle orchestration logic.

## Lifecycle Coverage

- Request decomposition:
  - `submit_request` creates a project and decomposes request text into multiple planned tasks.
- Assignment compatibility:
  - manual `assign_task`
  - `auto_assign` for unassigned tasks in a project
  - reassignment clears prior assignee links deterministically
- Transition model:
  - `planned` -> `in_progress` on simulation ticks once assigned
  - progress is tracked internally per task runtime state
  - `done` is reached via completion transitions (e.g., `approve_artifact`, `task_done` event)
- Project status is refreshed from task aggregate state (`planning` / `executing` / `blocked` / `completed`).

## Schema Safety

- Snapshot entities remain contract-safe with canonical fields only.
- Internal runtime progression metadata is stored separately and not emitted into snapshot entities.

## Validation

- `apps/server-world/test/simulation.test.mjs` adds lifecycle orchestration coverage:
  - decomposition behavior from `submit_request`
  - manual and auto assignment compatibility
  - reassignment correctness
  - done-state transitions

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
