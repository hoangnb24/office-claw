# Collider Plumbing and Nav Debug Overlay

Related bead: `bd-1b8`

## What was added
- `apps/client-web/src/scene/nav/pathfinding.ts`
  - Static blocker extraction from scene manifest object colliders (`type=box`).
  - Runtime merge of collider-derived blockers into nav walkability.
  - POI anchor reachability validation (`out_of_bounds`, `on_blocked_cell`, `unreachable`).
- `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
  - Uses collider-derived blockers as the canonical debug + pathing walkability source.
  - Emits anchor reachability warnings in console.
  - Renders anchor issue markers in-scene.
  - Debug visuals (path nodes + blocked cells + anchor issues) are gated by debug mode:
    - enabled in `DEV`, or
    - enabled when `VITE_NAV_DEBUG=1`.
- `apps/client-web/src/scene/nav/index.ts`
  - exports added for collider blocker + anchor validation helpers.

## Behavior
- Static blockers are no longer only hand-authored in `navigation.grid.walkable`; blocker cells are also generated from object colliders at runtime.
- Pathfinding automatically respects this merged blocker map.
- Anchor validation catches POI nav anchors that are outside the nav map or land on blocked/unreachable cells.
- Debug overlay now reflects computed blocker reality rather than only raw manifest bits.

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
