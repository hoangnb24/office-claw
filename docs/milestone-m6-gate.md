# Milestone M6 Gate Validation

Related bead: `bd-2yy`  
Date: `2026-02-14`

## Gate intent (PLAN.md M6)

- in-world artifacts are visible and inspectable in the Delivery Shelf / Artifact Viewer flow
- review actions are functional end-to-end (`approve_artifact`, `request_changes`, `split_into_tasks`)
- resulting lifecycle outcomes (approval, revision request, split fan-out) are reflected in world/task/decision state without manual patching

## Dependency closure

- `bd-w8u` (M5 gate): closed
- `bd-1x9` (artifact lifecycle orchestration + review hooks): closed
- `bd-3no` (Artifact Viewer panel + review controls): closed
- `bd-17v` (standardized loading/empty/error panel states): closed

## Exit criteria evaluation

### 1) Dependencies are completed and aligned with M6 gate intent

Status: **Pass**

Evidence:
- milestone baseline from M5:
  - `docs/milestone-m5-gate.md`
- artifact lifecycle authority:
  - `docs/server-world-artifact-lifecycle.md`
  - `apps/server-world/src/worldState.mjs`
- artifact client review surface:
  - `docs/client-artifact-viewer.md`
  - `apps/client-web/src/overlay/OverlayRoot.tsx`
- standardized panel state/error handling for review workflows:
  - `docs/client-panel-state-standards.md`

### 2) End-to-end demo path works without manual state patching

Status: **Pass**

Evidence mapping:
- Artifact appears in snapshot and review loop state:
  - `apps/client-web/src/network/useWorldSocket.ts` (`payload.artifacts[]` hydration)
  - `apps/client-web/src/state/uiStore.ts` (artifact snapshot/focus/notice state)
- Review commands and deterministic ack/error handling:
  - `apps/client-web/src/network/artifactCommands.ts`
  - `apps/client-web/src/network/useWorldSocket.ts`
  - `docs/command-taxonomy-and-error-model.md`
- Lifecycle outcomes:
  - approve -> `review_approved` (+ linked `task_done` when task exists)
  - request changes -> `review_changes_requested` + revision delivery lifecycle
  - split -> `tasks_created` fan-out
  - implemented in `apps/server-world/src/worldState.mjs` and `apps/server-world/src/worldServer.mjs`

Validation run in this pass:

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix apps/server-world test
npm --prefix contracts run validate
```

Result:
- all commands passed
- client build reports non-blocking chunk-size warning only

### 3) Known limitations/follow-ups are documented

Status: **Pass**

Tracked follow-ups:
1. `bd-2fr` canonical multi-flow integration coverage is in progress and should remain the primary reliability follow-through.
2. `bd-6o8` explainability cues and `bd-94r` accessibility baseline remain important UX hardening on top of this milestone.
3. client bundle chunk-size warning remains non-blocking but should be addressed in future optimization passes.

## Gate decision

`M6` is **validated**: artifact review loop capabilities are implemented and operating across server lifecycle + client viewer/action surfaces, with deterministic error handling and no manual state patching required for core approval/change/split outcomes.
