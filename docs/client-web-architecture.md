# Client-Web Bootstrap Architecture (bd-1ht)

This document defines ownership boundaries for the initial `apps/client-web` runtime.

## State Ownership

- `worldStore` (`src/state/worldStore.ts`)
  - Authoritative client representation of scene/runtime data from server snapshots/goals.
  - Owns connection state, scene identity, and normalized agent snapshots.
  - No transient UI interaction state should live here.

- `uiStore` (`src/state/uiStore.ts`)
  - Owns panel visibility and semantic focus state (`focusedPoiId`, `focusedAgentId`).
  - Drives overlay routing/presentation independent from render-loop internals.

- `interactionStore` (`src/state/interactionStore.ts`)
  - Owns high-frequency transient interaction data (hover/selection/pointer world position).
  - Isolated so pointer/raycast updates do not force broad world-state churn.

## Event Flow Baseline

1. App boots into `WorkspaceRoute` (`src/App.tsx`) and mounts both surfaces:
   - R3F `Canvas` + `OfficeScene`
   - React overlay root (`OverlayRoot`)
2. Input systems (raycast/keyboard/click handlers to be added in follow-up tasks) will write to `interactionStore`.
3. Semantic UI actions (open panel, focus POI, inspect agent) write to `uiStore`.
4. Network layer (follow-up tasks) writes snapshots/goals/events into `worldStore` and derives view data for overlays/scene renderers.
5. Scene/render modules consume `worldStore` for durable state and `interactionStore` for ephemeral hints.

## Why this split

- Prevents a monolithic store from coupling render-loop updates to every UI change.
- Keeps world simulation data modelable and testable in isolation.
- Allows later migration to server-authoritative simulation without rewriting UI state ownership.
