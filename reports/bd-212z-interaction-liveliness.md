# bd-212z Sprint A Interaction Liveliness

Generated: 2026-02-16T01:52:33Z

## Scope

Increase immediate interaction readability for Sprint A props:
- Inbox
- Task board
- Delivery shelf
- Blocker cone

## Implementation

### 1) Immediate UI feedback on POI interaction

Updated `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`:

- Added `pushPoiInteractionFeedback(...)` to set panel-specific notices on arrival/open:
  - Inbox -> `setInboxNotice(...)`
  - Task board -> `setTaskBoardNotice(...)`
  - Delivery shelf -> `setArtifactNotice(...)`
- Feedback is triggered both:
  1. when already inside interaction radius, and
  2. after path-based arrival to the POI.

### 2) Blocker cone state readability

Updated `apps/client-web/src/scene/OfficeScene.tsx`:

- Added `BlockerConeSignal` (animated pulsing torus + beacon) rendered on `delivery_cone_marker`.
- Signal activation is tied to blocked-task state:
  - `active = blockedTaskCount > 0`
- This creates an immediate in-scene cue that blocker state is active.

## Per-prop verification notes

1. Inbox (`poi_reception_inbox`)
   - Interaction opens Inbox panel and posts success notice via `setInboxNotice`.
2. Task board (`poi_task_board`)
   - Interaction opens Task Board and posts success notice via `setTaskBoardNotice`.
3. Delivery shelf (`poi_delivery_shelf`)
   - Interaction opens Artifact Viewer and posts success notice via `setArtifactNotice`.
4. Blocker cone (`delivery_cone_marker`)
   - In-scene pulsing blocker signal appears while any task is `blocked`, and naturally quiets when blockers clear.

## Validation

1. `npm --prefix apps/client-web run typecheck` passed.
2. `npm --prefix apps/client-web run build` passed.
3. `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight.bd-38md.md` passed.
