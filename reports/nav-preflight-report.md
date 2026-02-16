# Nav Preflight Report

Generated: 2026-02-15T12:49:01.135Z
Scene manifest: `assets/scenes/cozy_office_v0.scene.json`
Report path: `reports/nav-preflight-report.md`

## Summary

- POIs checked: 3
- Anchors checked: 3
- Blocking issues: 0
- Base grid blocked cells: 72
- Collider-induced blocked cells (unique): 40
- Collider-induced newly blocked walkable cells: 0
- Effective blocked cells after collider merge: 72
- Effective walkable cells after collider merge: 504
- Path-start source: manifest.spawns.player -> nearest_walkable
- Path-start world position: (0.625, 0.000, -0.375)

## Collider Block States

| Object ID | Blocked Cells |
|---|---:|
| delivery_shelf | 12 |
| desk_01 | 28 |

## Anchor Reachability Findings

No issues found.

## Gate Behavior

- Exit code `0`: no blocking issues found.
- Exit code `1`: one or more blocking issues found or scene parsing failed.
- Re-run command:
  - `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.md`
