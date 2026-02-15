# Player Click-to-Move and Walk-to-Interact

Related bead: `bd-2f9`

## Implementation mapping
- `click-to-move pathing`
  - `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
    - consumes click intents carrying a world `point`
    - runs local A* (`findPathOnGrid`) and applies the path to `playerStore`
- `interaction radius checks before panel open`
  - `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
    - resolves POI anchor + `interaction_radius_m`
    - if already in radius: opens panel immediately
    - if outside radius: defers panel action and starts movement
- `deferred action trigger on arrival`
  - `apps/client-web/src/state/playerStore.ts`
    - maintains movement path + pending POI action state
  - `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
    - per-frame check opens panel when radius condition is met on arrival

## Operational notes
- Pathfinding uses the nav module in `apps/client-web/src/scene/nav/pathfinding.ts`.
- Occupied agent cells are treated as blockers during path solve.
- Debug overlays (path nodes, blocker map, anchor issue markers) are gated to debug mode:
  - enabled in `DEV`
  - or set `VITE_NAV_DEBUG=1`

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
