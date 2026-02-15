# Client-Local Navgrid Pathfinding

Related bead: `bd-1mt`

## What was added
- `apps/client-web/src/scene/nav/pathfinding.ts`
  - Manifest-backed navgrid runtime parsing.
  - Local A* pathfinding with occupancy-aware blocking.
  - Grid/world conversion helpers and blocked-cell debug markers.
- `apps/client-web/src/state/playerStore.ts`
  - Local player position/path state.
  - Per-frame path traversal.
  - Nav debug status, path node count, and cell telemetry.
- `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
  - Consumes interaction intents for click-to-move.
  - Walk-to-interact gating for POI panel commands.
  - Renders local player marker, path nodes, and blocked-cell markers.
- `apps/client-web/src/App.tsx`
  - Mounts `LocalNavigationLayer` in the scene.
- `apps/client-web/src/scene/OfficeScene.tsx`
  - Marks floor as interactive `ground_nav_surface` for movement intents.
- `apps/client-web/src/overlay/OverlayRoot.tsx`
  - Adds local-nav debug readout (player position, path nodes, nav state, grid metrics).
- `assets/scenes/cozy_office_v0.scene.json`
- `apps/client-web/src/scene/highlight/cozy_office_v0.scene.json`
  - Navigation grid expanded to a 24x24 local office map with explicit blocked cells.

## Behavior
- Clicking walkable ground computes a local path and moves the player marker along that route.
- Clicking a POI with an action panel now gates the panel behind movement:
  - If already within `interaction_radius_m`, panel opens immediately.
  - If outside radius, client paths toward a POI nav anchor and opens panel on arrival.
- Occupied cells (from current agent positions in world store) are treated as blocked during path solve.
- Debug visualization shows:
  - blocked nav cells in-world
  - player marker
  - active path nodes
  - overlay metrics for last navigation solve

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
