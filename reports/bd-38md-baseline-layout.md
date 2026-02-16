# bd-38md Baseline Layout and Anchor Verification

Generated: 2026-02-16T01:47:46Z

## Scope

Validate Sprint A baseline scene layout unblockers for `cozy_office_v0`:
1. Baseline transforms in `assets/scenes/cozy_office_v0.scene.json`.
2. Explicit desk POI/nav anchor for follow-on sit/work behavior.
3. Collider/nav sanity and startup asset URL health.

## Manifest changes

- Added POI: `poi_dev_desk_1` (`type: dev_desk`) with nav anchor:
  - `id: sit_work`
  - `pos: [0.125, 0, -0.375]`
  - `facing: [0.03, 0, 1]`
- Linked desk object `desk_01` to new POI:
  - `poi_id: "poi_dev_desk_1"`
  - `interaction_radius_m: 1.15`
  - `highlight_nodes: ["DeskTop"]`

## Verification evidence

1. Nav preflight:
   - Command: `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight.bd-38md.md`
   - Result: `PASS` (`Blocking issues: 0`)
   - Report: `reports/nav-preflight.bd-38md.md`

2. Client typecheck/build:
   - `npm --prefix apps/client-web run typecheck` passed.
   - `npm --prefix apps/client-web run build` passed.

3. Runtime asset URL probe in dev mode (`VITE_SCENE_ID=cozy_office_v0`):
   - `/assets/office_shell.glb` -> `200`
   - `/assets/inbox.glb` -> `200`
   - `/assets/task_board.glb` -> `200`
   - `/assets/shelf.glb` -> `200`
   - `/assets/desk.glb` -> `200`
   - `/assets/blocker_cone.glb` -> `200`

## Outcome

`bd-38md` acceptance criteria are satisfied for baseline layout/anchor readiness:
- Scene baseline includes Sprint A props and desk anchor for follow-on behavior.
- Collider/nav preflight is clean.
- Startup-facing asset URLs for manifest objects are healthy.
