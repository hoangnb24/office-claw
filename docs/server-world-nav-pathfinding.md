# Server World Nav Grid Pathfinding

Linked bead: `bd-1qf`

## What shipped

- Added scene-manifest nav-grid loader: `apps/server-world/src/nav/manifestNav.mjs`
  - loads `assets/scenes/<scene_id>.scene.json`
  - validates presence of `navigation.grid`
  - builds runtime nav grid via `createNavGridRuntime`
  - caches loaded grids per `scene_id + manifest path`
- Added server nav runtime wiring in `apps/server-world/src/worldState.mjs`
  - `player_pos` now updates canonical player agent (`agent_bd`) position/facing
  - `move_player_to` now performs A* path solving on the active scene grid
  - occupancy safeguards include all other agent positions as blocked cells
  - failed solve returns deterministic `NOT_ALLOWED`
- Added world/grid conversion helpers on world-state store
  - `worldToGridCell(worldPos)`
  - `gridCellToWorld(cell, y?)`
  - `getNavigationState()` for debug/test visibility (`grid`, load metadata, last move plan)

## Routing behavior

- Start position: current `agent_bd.pos`
- Target: requested `move_player_to.data.pos`
- Path search: cardinal-neighbor A* (`findPathOnGrid`)
- Occupancy:
  - current player cell is allowed for start
  - other agent cells are treated as blocked
  - occupied target cells resolve to nearest walkable neighbor when possible
- Final committed position:
  - snapped to resolved target cell center (`cellToWorld`)
  - remains deterministic and grid-aligned

## Failure and edge cases

- Missing/invalid nav grid for active scene: `NOT_ALLOWED`
- Unreachable target (no traversable path): `NOT_ALLOWED`
- Invalid command payload shape: `VALIDATION_FAILED` (existing command taxonomy)

## Validation

- `npm --prefix apps/server-world test`
- `npm --prefix contracts run validate`

## Test coverage

- `apps/server-world/test/nav.test.mjs`
  - scene manifest nav-grid load
  - occupancy-aware target adjustment
  - world-state command routing success path
  - unreachable target failure path
