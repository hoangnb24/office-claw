# Milestone M2 Gate Validation

Related bead: `bd-3mh`  
Date: `2026-02-14`

## Gate intent (PLAN.md M2)
- responsive click-to-move
- collision safety against props/blockers
- walk-to-interact (path into `interaction_radius_m`, then trigger interaction)

## Dependency closure
- `bd-32k`: closed
- `bd-2f9`: closed
- `bd-1b8`: closed

## Criteria check
1. All milestone dependencies completed and validated.
   - Verified via `br show` for each dependency.
2. End-to-end demo path works without manual patching.
   - Click intents route through interaction manager into nav layer (`apps/client-web/src/scene/interaction/useInteractionManager.ts`, `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`).
   - Local A* pathing and world/grid conversion run in nav runtime (`apps/client-web/src/scene/nav/pathfinding.ts`).
   - Collider-derived blocked cells are merged into walkability, preventing straight-through prop traversal (`apps/client-web/src/scene/nav/pathfinding.ts`).
   - Deferred POI action opens after radius arrival (walk-to-interact gate) (`apps/client-web/src/state/playerStore.ts`, `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`).
3. Known limitations documented.
   - Camera-follow toggle is not yet a dedicated implemented control in this slice; keep as follow-up under client usability/polish tracks (`bd-e7n`, `bd-zax`).
   - Full visual/manual validation remains tracked in `bd-2ii` and `bd-2cx`.

## Verification
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
