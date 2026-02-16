# Asset Budget Summary and Exception Log

Related bead: `bd-tf2`
Generated: 2026-02-15

## Sources
- Inventory map: `CLIENT_ART_PRODUCTION_LIST.md` (Asset Inventory Lock and ID Map)
- Budget policy: `docs/client-asset-budget-matrix.md`
- Validation evidence:
  - `reports/glb-preflight-report.md`
  - `reports/glb-preflight-disposition.md`

## Command Evidence
- `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.md`
  - Result: pass (`Errors: 0`, `Warnings: 4`)
- `node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --dry-run`
  - Result: required clip contract already satisfied (`Idle`, `Walk`, `Work_Typing`, `Think`)

## Per-Asset Budget Summary (Current Generated Set)

P0 budget thresholds used for this pass:
- triangles per asset: `<= 75,000`
- materials per asset: `<= 6`

| Asset ID | Tier | File | Size (MB) | Triangles | Materials | Budget Status | Notes |
|---|---|---|---:|---:|---:|---|---|
| `office_shell` | P0 | `assets/glb/office_shell.glb` | 0.00 | 12 | 1 | pass | within P0 budget |
| `prop_inbox` | P0 | `assets/glb/inbox.glb` | 0.00 | 12 | 1 | pass | within P0 budget |
| `prop_task_board` | P0 | `assets/glb/task_board.glb` | 0.00 | 12 | 1 | pass | within P0 budget |
| `prop_delivery_shelf` | P0 | `assets/glb/shelf.glb` | 12.67 | 48,764 | 1 | pass | scale warning dispositioned |
| `prop_dev_desk` | P0 | `assets/glb/desk.glb` | 12.67 | 48,764 | 1 | pass | scale warning dispositioned |
| `prop_blocker_cone` | P0 | `assets/glb/blocker_cone.glb` | 0.00 | 12 | 1 | pass | within P0 budget |
| `agent_base_skeleton` | P0 | `assets/glb/agent1_skeleton.glb` | 12.67 | 48,764 | 1 | pass | scale warning dispositioned |
| `agent_animation_bundle` | P0 | `assets/glb/agent1_animations.glb` | 13.09 | 48,764 | 1 | pass | clip contract pass; scale warning dispositioned |

## Exception Log

All exceptions below are warning-level acceptances (non-blocking) and include explicit owner/rationale.

| Exception ID | Asset ID | Exception | Owner | Rationale | Expiration Milestone |
|---|---|---|---|---|---|
| `EX-2026-02-15-001` | `agent_animation_bundle` | Armature scale warning (`~0.01`) | `MagentaTower` | Current runtime behavior and clip contract are stable; warning accepted temporarily to unblock phase progression. | `bd-295o` |
| `EX-2026-02-15-002` | `agent_base_skeleton` | Armature scale warning (`~0.01`) | `MagentaTower` | Skeleton artifact not currently manifest-bound scene geometry; warning accepted pending normalization batch. | `bd-295o` |
| `EX-2026-02-15-003` | `prop_dev_desk` | Armature scale warning (`~0.01`) | `MagentaTower` | Functional/runtime checks pass; defer export-unit cleanup to dedicated compression/normalization pass. | `bd-295o` |
| `EX-2026-02-15-004` | `prop_delivery_shelf` | Armature scale warning (`~0.01`) | `MagentaTower` | Functional/runtime checks pass; defer export-unit cleanup to dedicated compression/normalization pass. | `bd-295o` |

## Machine-Readable Snapshot (JSON)

```json
[
  {"asset_id":"office_shell","tier":"P0","file":"assets/glb/office_shell.glb","size_mb":0.0,"triangles":12,"materials":1,"budget_status":"pass"},
  {"asset_id":"prop_inbox","tier":"P0","file":"assets/glb/inbox.glb","size_mb":0.0,"triangles":12,"materials":1,"budget_status":"pass"},
  {"asset_id":"prop_task_board","tier":"P0","file":"assets/glb/task_board.glb","size_mb":0.0,"triangles":12,"materials":1,"budget_status":"pass"},
  {"asset_id":"prop_delivery_shelf","tier":"P0","file":"assets/glb/shelf.glb","size_mb":12.67,"triangles":48764,"materials":1,"budget_status":"pass","exception_id":"EX-2026-02-15-004"},
  {"asset_id":"prop_dev_desk","tier":"P0","file":"assets/glb/desk.glb","size_mb":12.67,"triangles":48764,"materials":1,"budget_status":"pass","exception_id":"EX-2026-02-15-003"},
  {"asset_id":"prop_blocker_cone","tier":"P0","file":"assets/glb/blocker_cone.glb","size_mb":0.0,"triangles":12,"materials":1,"budget_status":"pass"},
  {"asset_id":"agent_base_skeleton","tier":"P0","file":"assets/glb/agent1_skeleton.glb","size_mb":12.67,"triangles":48764,"materials":1,"budget_status":"pass","exception_id":"EX-2026-02-15-002"},
  {"asset_id":"agent_animation_bundle","tier":"P0","file":"assets/glb/agent1_animations.glb","size_mb":13.09,"triangles":48764,"materials":1,"budget_status":"pass","exception_id":"EX-2026-02-15-001"}
]
```
