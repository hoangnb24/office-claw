# Client Override Controls (`bd-2ng`)

## Scope

Implemented client-side override affordances for task/project controls in:

- `Task Board`
- `Agent Inspector`

Files:
- `apps/client-web/src/network/overrideCommands.ts` (new)
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Commands Wired

- `reassign_task`
- `cancel_task` (`confirm=true`)
- `pause_project` (`scope=dispatch_only`)
- `resume_project`
- `rerun_task` (`mode=clone_as_new`)

## UX Behavior

- Task Board now exposes override actions on task cards:
  - `Reassign` (planned/blocked assigned tasks)
  - `Cancel` with explicit second-click confirmation
  - `Rerun` for terminal tasks (`done`/`cancelled`)
- Task Board actions now include project-level:
  - `Pause Dispatch`
  - `Resume Dispatch`
- Agent Inspector now includes an Override Controls section with the same core command set.

## Confirmation and Rollback UX

- Destructive cancel actions require two clicks (`Cancel` → `Confirm Cancel`).
- All override requests set deterministic pending notices.
- Ack/error handling is centralized in `useWorldSocket` command-result mapping:
  - success notices describe expected reflected state
  - errors use deterministic microcopy (`overrideErrorMicrocopy`) with actionable “next” guidance
- Semantic override events (`task_reassigned`, `task_cancelled`, `project_paused`, `project_resumed`) also produce clear Task Board notices so reflected state is obvious.

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```
