# Task Board Onboarding Copy Affordance Alignment (bd-24w1)

Generated: 2026-02-15T13:32:00Z

## Objective

Align guided onboarding Step 2 copy with actual Task Board interaction affordances so first-time users can discover and verify the expected action path.

## Changes

### 1) Updated guided onboarding Step 2 copy

Updated `apps/client-web/src/overlay/OverlayRoot.tsx` (`ONBOARDING_FLOW_STEPS`):
- previous wording implied drag-only behavior.
- new primary copy explicitly presents both supported paths:
  - drag task card to specialist column
  - use Auto-Assign
- new secondary copy explicitly says cards are draggable and references the runtime drag hint (`Moving ...`).

### 2) Added persistent Task Board discoverability cue

Updated `apps/client-web/src/overlay/OverlayRoot.tsx` (Task Board panel):
- added inline tip above task cards:
  - drag task cards onto specialist columns
  - or use `Trigger Auto-Assign`

This makes the expected interaction visible even before a user starts dragging.

### 3) Updated onboarding documentation

Updated `docs/client-guided-onboarding-flow.md`:
- Step 2 now documents both interaction paths and the discoverability hint in-panel.

## Acceptance Mapping

1. Guided copy no longer implies unavailable/broken drag-only behavior: ✅
2. Discoverability cue is present in runtime Task Board panel: ✅
3. Documentation reflects runtime behavior: ✅

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix contracts run validate
```

Results:
- typecheck: pass
- build: pass
- contracts validate: pass
