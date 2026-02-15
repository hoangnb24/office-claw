# Client First-Run Help Overlay

`bd-3mq` introduces a lightweight first-run controls/help overlay for client-only onboarding.

## Behavior

- First-run help card renders in the left overlay column with:
  - quick goal statement for the first slice run
  - concise 3-step interaction guidance
  - quick actions (`Got It`, `Open Event Feed`)
- Dismiss/reopen:
  - `Got It` hides the card and stores dismissal in local storage
  - `Show Help` button in panel actions reopens it and clears dismissal state
- Guidance copy aligns with current onboarding flow:
  - move + POI interaction
  - event-feed traceability
  - decision resolution -> task board resume loop

## Files

- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
