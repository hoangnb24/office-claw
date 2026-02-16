# Client-Local Navgrid Pathfinding

Related beads: `bd-1mt`, `bd-2zn`

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

## Nav Preflight Gate
- `tools/nav-preflight.mjs`
  - Validates POI nav anchors against the effective nav grid after collider blockers are applied.
  - Uses `spawns.player` as the pathing start reference (with deterministic fallback to first walkable cell when needed).
  - Fails non-zero on non-compliant manifests so it can be used as a strict gate.

### Command
```bash
node tools/nav-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --out reports/nav-preflight-report.md
```

Notes:
- `--report` is an alias for `--out`.
- Defaults:
  - scene: `assets/scenes/cozy_office_v0.scene.json`
  - report: `reports/nav-preflight-report.md`

### Report Contract
`reports/nav-preflight-report.md` contains:
- summary counts for POIs, anchors, base/merged blocked cells, and collider-induced blockers
- per-object collider blocked-cell counts
- anchor findings table with:
  - `Severity`
  - `POI`
  - `Anchor`
  - `Reason` (`anchor_out_of_bounds`, `anchor_on_blocked_cell`, `anchor_unreachable`, `anchor_invalid_position`)
  - anchor position, mapped cell, nearest walkable fallback cell, and diagnostics details

### Failure Behavior
- Exit code `0`: no blocking issues.
- Exit code `1`: one or more blocking issues, missing/invalid scene manifest, or invalid nav section.

## Authoring Coordinate Capture Helper
- Dev-only helper is available in the in-client Debug HUD (`VITE_NAV_DEBUG=1` or dev mode).
- Demo/dev low-noise defaults keep HUD and nav overlays off until enabled from the HUD toggle
  (or forced via `VITE_DEBUG_HUD=1` / `VITE_NAV_DEBUG=1`).
- Capture workflow:
  - press `R` to hot-reload the active scene manifest from `/scenes/<scene_id>.scene.json` without restarting the app
  - hover/select a POI in scene and press `C` to capture an anchor patch snippet
  - hover/select a POI or object and press `Shift+C` to capture an object/collider patch snippet
- Output behavior:
  - snippet is copied to clipboard when browser permissions allow
  - snippet is always logged to console with `[nav-authoring]`
  - latest snippet is shown in Debug HUD under "Authoring capture"

Snippet contract:
- format is JSON with:
  - `capture_kind`
  - target identity fields (`poi_id`/`anchor_id` or `object_id`)
  - `captured_world_pos`
  - `json_patch` array with patch-ready operations for `assets/scenes/*.scene.json`
