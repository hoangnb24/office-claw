# Client Explainability Cues (`bd-6o8`)

Last updated: 2026-02-14

## Scope

Added explainability-focused UI cues so assignment/blocker/artifact states answer "why did this happen?" with direct timeline linkage.

Files:
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/styles.css`

## What Was Added

### Task-level "Why" cues
- Task cards now include a short `Why:` explanation derived from latest related event:
  - assignment updates
  - blocker/decision transitions
  - completion/cancellation lifecycle outcomes
- Each task card has `Trace in timeline` to jump to Event Feed and linked panel context.

### Artifact provenance hints
- Artifact detail card now surfaces:
  - source task + assignee provenance
  - latest related timeline event/time
- Added artifact `Trace in timeline` action for cross-panel traceability.

### Agent Inspector rationale
- Agent Inspector now includes `Why this state` based on most recent relevant lifecycle event.

### Event-driven notices
- Socket event handling now raises concise notices for:
  - assignment events (`task_assigned`)
  - blocker transitions (`decision_requested` / `task_blocked`)

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```
