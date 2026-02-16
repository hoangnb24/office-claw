# Client Guided Onboarding Flow (`bd-57w`)

Last updated: 2026-02-14

## Scope

Implemented a stepwise guided first-run flow across core POIs with skip/replay controls and lightweight instrumentation.

Files:
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Guided Steps

1. Inbox (`poi_reception_inbox`)
2. Task Board (`poi_task_board`)
   - onboarding copy now explicitly calls out both interaction paths:
     - drag a task card onto a specialist column
     - use `Trigger Auto-Assign` when manual drag is not preferred
   - runtime panel includes a persistent discoverability hint above task cards.
3. Delivery Shelf / Artifact Viewer (`poi_delivery_shelf`)
4. Decision Panel (blocker loop)

The overlay now supports:
- `Start Guided Flow`
- `Back` / `Next` / `Finish`
- `Skip`
- `Replay`

## Instrumentation

Tracked in `uiStore`:
- onboarding active state + current step index
- per-step visit counts (`stepVisits`)
- start/completion/skip timestamps
- drop-off step id when skipped

Metrics are surfaced in the first-run help card for quick UX readout.

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```

## Polish Signoff Mapping (`bd-v0c9`)

The guided flow contributes directly to user-facing polish criteria:

1. Discoverability
   - Task Board step copy explicitly shows both manual drag and `Trigger Auto-Assign`.
   - Persistent hint above task cards keeps assignment paths visible.
2. Trust
   - Step transitions should align with event-feed focus behavior and panel context updates.
   - Any mode-specific transition failure is treated as a signoff risk.
3. Flow completion
   - Successful end-to-end walkthrough should cover Inbox -> Task Board -> Delivery Shelf -> Decisions.
   - Skip/drop-off metrics are used as supporting evidence during freeze review.
