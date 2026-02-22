# Alive Slice Asset Lock (No Audio)

## Canonical Runtime Winners

| Role | Canonical GLB | Runtime URL | Notes |
|---|---|---|---|
| Office shell | `assets/glb/office_shell.glb` | `/assets/office_shell.glb` | Primary environment shell |
| Inbox POI | `assets/glb/inbox.glb` | `/assets/inbox.glb` | Reception interaction asset |
| Task board POI | `assets/glb/task_board.glb` | `/assets/task_board.glb` | Planning board interaction asset |
| Delivery shelf POI | `assets/glb/shelf.glb` | `/assets/shelf.glb` | Artifact drop/review shelf |
| Dev desk POI | `assets/glb/desk.glb` | `/assets/desk.glb` | Workspace hero prop |
| Blocker cone | `assets/glb/blocker_cone.glb` | `/assets/blocker_cone.glb` | Blocked-state visual marker |
| Agent skeleton | `assets/glb/agent1_skeleton.glb` | `/assets/agent1_skeleton.glb` | Character base |
| Agent animation bundle | `assets/glb/agent1_animations.glb` | `/assets/agent1_animations.glb` | Runtime clip source |

## Staging-Only Variants (Do Not Reference in Scene Manifest)

- `assets/glb/office_shell_generated.glb`
- `assets/glb/prop_inbox_generated.glb`
- `assets/glb/prop_task_board_generated.glb`
- `assets/glb/prop_delivery_shelf_generated.glb`
- `assets/glb/prop_dev_desk_generated.glb`
- `assets/glb/prop_dev_desk_text_generated.glb`
- `assets/glb/prop_blocker_cone_text_generated.glb`
- `assets/glb/desk.pre_text2desk_20260215T154142Z.glb`

## Contract Fixes Applied

- `DeskTop` highlight node references were updated to `Mesh0` in `assets/scenes/cozy_office_v0.scene.json` for `poi_dev_desk_1` and its desk object mapping.

## Validation Commands

```bash
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md
node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.latest.md
npm --prefix apps/client-web run assets:sync
npm --prefix apps/client-web run assets:verify
node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.latest.md
```

## Missing Pieces We Can Generate with Existing Pipeline

Use this queue only for true missing/replacement assets after gameplay polish review.

| Asset ID | Purpose | Input refs needed | Command |
|---|---|---|---|
| `<new_prop_id>` | Additional set dressing or hero replacement | 1-4 reference images | `python3 tools/meshy_pipeline.py --image <img> --asset-id <new_prop_id> --output-dir assets/glb --manifest-out reports/meshy-<new_prop_id>-manifest.json` |
| `<agent_variant_id>` | Secondary NPC look variant | front/back character refs | `python3 tools/meshy_pipeline.py --image <front> --image <back> --asset-id <agent_variant_id> --output-dir assets/glb --manifest-out reports/meshy-<agent_variant_id>-manifest.json --rig` |

For agent animation bundles, normalize clip names after generation:

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb
```

