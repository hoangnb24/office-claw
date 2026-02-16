# Asset Budget Summary and Exception Log (bd-tf2)

Generated: 2026-02-15T12:53:50Z
Source assets: `assets/glb`
Related docs/reports:
- `docs/client-asset-budget-matrix.md`
- `reports/glb-preflight-report.bd-24s.md`
- `reports/glb-preflight-warnings.bd-24s.md`

## Result

- Budget status: `conditional pass`
- Blocking budget/preflight errors: `0`
- Open exceptions: `4` (all scale-normalization warnings, owned and time-bounded)

## Budget Thresholds Applied

Per `docs/client-asset-budget-matrix.md` (P0):
- Triangles per asset: `<= 75,000`
- Materials per asset: `<= 6`

## Per-Asset Summary

| Asset File | Tier | Size (KB) | Triangles (est) | Materials | Animations | Triangle Budget | Material Budget | Status |
|---|---|---:|---:|---:|---:|---|---|---|
| `agent1_animations.glb` | P0 | 13408.4 | 48764 | 1 | 6 | pass (`48764 <= 75000`) | pass (`1 <= 6`) | pass |
| `agent1_skeleton.glb` | P0 | 12971.4 | 48764 | 1 | 1 | pass (`48764 <= 75000`) | pass (`1 <= 6`) | pass |
| `blocker_cone.glb` | P0 | 1.6 | 12 | 1 | 0 | pass | pass | pass |
| `desk.glb` | P0 | 12971.4 | 48764 | 1 | 1 | pass (`48764 <= 75000`) | pass (`1 <= 6`) | pass |
| `inbox.glb` | P0 | 1.6 | 12 | 1 | 0 | pass | pass | pass |
| `office_shell.glb` | P0 | 1.6 | 12 | 1 | 0 | pass | pass | pass |
| `shelf.glb` | P0 | 12971.4 | 48764 | 1 | 1 | pass (`48764 <= 75000`) | pass (`1 <= 6`) | pass |
| `task_board.glb` | P0 | 1.6 | 12 | 1 | 0 | pass | pass | pass |

## Exception Log

| Exception ID | Asset | Metric | Observed | Owner | Rationale | Mitigation | Expiration |
|---|---|---|---|---|---|---|---|
| `EX-BD-TF2-001` | `agent1_animations.glb` | preflight `scale` warning | armature scale `~0.01` | `PurpleOtter` | Current runtime playback and preflight gate pass; warning inherited from current export convention. | Normalize scale during asset optimization/compression pass. | `bd-295o` completion |
| `EX-BD-TF2-002` | `agent1_skeleton.glb` | preflight `scale` warning | armature scale `~0.01` | `PurpleOtter` | Skeleton integrates with runtime rig expectations; no blocking errors. | Normalize rig/object scale in next skeleton re-export cycle. | `bd-295o` completion |
| `EX-BD-TF2-003` | `desk.glb` | preflight `scale` warning | armature scale `~0.01` | `PurpleOtter` | Scene/nav behavior is stable and currently validated. | Normalize object transform in next compression/cleanup batch. | `bd-295o` completion |
| `EX-BD-TF2-004` | `shelf.glb` | preflight `scale` warning | armature scale `~0.01` | `PurpleOtter` | Interaction anchors/colliders remain stable after preflight/nav checks. | Normalize object transform in next compression/cleanup batch. | `bd-295o` completion |

## Repro Commands

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --dry-run
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.bd-24s.md
node tools/qa/run-qa-gates.mjs --only preflight
```

## Machine-Readable Snapshot

```json
{
  "issue_id": "bd-tf2",
  "status": "conditional_pass",
  "asset_count": 8,
  "exceptions": 4,
  "exceptions_owner": "PurpleOtter",
  "exception_expiration": "bd-295o",
  "preflight_report": "reports/glb-preflight-report.bd-24s.md"
}
```
