# Nav Preflight Report

Generated: 2026-02-16T02:14:40.456Z
Scene manifest: `assets/scenes/cozy_office_v0.scene.json`
Report path: `reports/nav-preflight.bd-3qzg.md`

## Summary

- POIs checked: 4
- Anchors checked: 4
- Blocking issues: 0
- Base grid blocked cells: 72
- Collider-induced blocked cells (unique): 70
- Collider-induced newly blocked walkable cells: 36
- Effective blocked cells after collider merge: 108
- Effective walkable cells after collider merge: 468
- Path-start source: manifest.spawns.player -> nearest_walkable
- Path-start world position: (0.625, 0.000, -0.375)

## Collider Block States

| Object ID | Blocked Cells |
|---|---:|
| delivery_cone_marker | 6 |
| delivery_shelf | 12 |
| desk_01 | 28 |
| inbox_reception | 12 |
| task_board_wall | 12 |

## Anchor Reachability Findings

No issues found.

## Gate Behavior

- Exit code `0`: no blocking issues found.
- Exit code `1`: one or more blocking issues found or scene parsing failed.
- Re-run command:
  - `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight.bd-3qzg.md`
