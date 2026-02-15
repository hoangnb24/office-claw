# Milestone C1U Gate Validation

Related bead: `bd-e7n`  
Date: `2026-02-14`

## Gate intent (Client-first usability hardening)

Validate that the client-first slice is usable for first-run users before broader rollout pressure, with explicit checks for:

- onboarding/help clarity
- accessibility expectation coverage
- loading/failure fallback behavior
- measurable findings for follow-up prioritization

## Dependency closure

- `bd-gtq` (C1 core client-only playable gate): closed
- `bd-3mq` (first-run help overlay): closed
- `bd-hgb` (asset loading progress + fallback UX): closed
- `bd-29d` (accessibility requirements + matrix): closed
- `bd-qwe` (onboarding narrative + milestones): closed
- `bd-3cx` (outcome metrics + research protocol): closed

## Exit criteria evaluation

### 1) First-run help/onboarding guidance validated

Status: **Pass**

Evidence:
- Help overlay behavior and persistence:
  - `docs/client-first-run-help-overlay.md`
  - `apps/client-web/src/overlay/OverlayRoot.tsx`
  - `apps/client-web/src/state/uiStore.ts`
- Narrative and milestone arc:
  - `ONBOARDING_NARRATIVE.md`

Result:
- First-run quick-start guidance is present, dismissible, and recoverable (`Show Help`).
- Guidance maps to current client loop (move -> POI panels -> event feed -> decisions).

### 2) Accessibility expectations checked/documented/applied

Status: **Warning (partial application)**

Evidence:
- Requirements and WCAG-oriented test matrix:
  - `ACCESSIBILITY_MATRIX.md`
- Current UI implementation:
  - `apps/client-web/src/overlay/OverlayRoot.tsx`
  - `apps/client-web/src/styles.css`

Findings:
- Keyboard-operable controls exist for many actions (buttons/textareas/events).
- Reduced-motion handling is not yet implemented in client runtime/UI code.
- Explicit focus-management patterns (focus return, traps where needed, robust focus styling) are not yet fully enforced.

Follow-up priority:
- `bd-94r` should remain high-priority before broad usability sign-off.

### 3) Loading/error fallback UX tested and documented

Status: **Pass**

Evidence:
- Resilience behavior and failure policy:
  - `docs/asset-loading-resilience.md`
  - `apps/client-web/src/scene/assets/useSceneAssets.ts`
  - `apps/client-web/src/overlay/OverlayRoot.tsx`
- Deterministic offline QA scenario launcher:
  - `tools/qa/run-visual-qa.sh --mode offline`
  - `docs/visual-qa-checklist.md`

Result:
- Startup progress, non-critical placeholder fallback, and critical failure guidance are all explicitly surfaced.
- Offline manual scenario order is documented and reproducible.

### 4) Metrics and findings captured for prioritization

Status: **Pass**

Evidence:
- Thresholds and decision rubric:
  - `docs/ux-outcome-metrics-and-research-protocol.md`
- Onboarding outcome heuristics:
  - `ONBOARDING_NARRATIVE.md`

Prioritized follow-ups:
1. `bd-94r` accessibility baseline implementation (keyboard/focus/reduced-motion).
2. run full C1U UX rounds against `docs/ux-outcome-metrics-and-research-protocol.md` scenarios.
3. resolve active client type errors from in-progress bead work before final release sign-off.

## Validation run (this pass)

Executed:

```bash
tools/qa/run-visual-qa.sh --mode offline
```

Result: ✅ script executed and emitted deterministic offline scenario plan.

Executed:

```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build
```

Result: ❌ currently failing due active in-progress changes in `apps/client-web/src/network/useWorldSocket.ts`:
- `TS18046: 'version' is of type 'unknown'`
- `TS2322: Type 'unknown' is not assignable to type 'number'`

Note:
- These errors surfaced during concurrent work on `bd-3no`; rerun C1U command checks after that bead stabilizes.

## Gate decision

`C1U` is **Conditionally validated** for documentation and UX-hardening readiness:

- onboarding and loading/error resilience criteria are met
- accessibility baseline application is partial and must be completed (`bd-94r`)
- final green build/typecheck must be re-verified after active client in-progress work lands
