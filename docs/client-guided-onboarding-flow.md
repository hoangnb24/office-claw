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
