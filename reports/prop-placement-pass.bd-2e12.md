# Prop Placement and Spatial Storytelling Pass (bd-2e12)

Generated: 2026-02-15T12:58:10Z
Scene: `assets/scenes/cozy_office_v0.scene.json`

## Goals

1. Strengthen POI zoning readability (reception, planning, delivery).
2. Improve visual hierarchy with explicit prop anchors near each interactive lane.
3. Preserve movement reliability and interaction clarity (no blocked anchors).

## Layout Changes

### POI Anchor and UI Framing Updates

| POI | Before | After | Intent |
|---|---|---|---|
| `poi_reception_inbox` | anchor `pos=[2.4,0,-1.2]` | anchor `pos=[2.6,0,-1.2]`, updated `ui_anchor` | keep stand point outside inbox collider while preserving reception approach lane |
| `poi_task_board` | anchor `pos=[1.2,0,2.0]`, ui anchor `z=1.8` | anchor `pos=[1.2,0,1.85]`, ui anchor `z=1.65` | bring stand zone closer to board wall and tighten board focus area |
| `poi_delivery_shelf` | no `ui_anchor` / `camera_framing` | added `ui_anchor` and `camera_framing` | improve delivery area affordance and framing consistency |

### Object Placement Updates

| Object | Before | After | Notes |
|---|---|---|---|
| `delivery_shelf` | `pos=[-1,0,2.2]` | `pos=[-1.25,0,1.95]` | better alignment with delivery POI stand lane |
| `desk_01` | `pos=[0.5,0,0.4]`, `rot=[0,1.57,0]` | `pos=[0.15,0,0.55]`, `rot=[0,1.2,0]` | opens central path and improves sightline to task board |
| `inbox_reception` | not present | added `/assets/inbox.glb` near reception zone | makes inbox POI visually explicit |
| `task_board_wall` | not present | added `/assets/task_board.glb` near planning zone | establishes board wall as anchor for task-board flow |
| `delivery_cone_marker` | not present | added `/assets/blocker_cone.glb` in delivery lane | subtle storytelling cue for delivery/blocker context |

## Interaction and Navigation Safety

Validation commands:

```bash
node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.bd-2e12.md
npm --prefix contracts run validate
npm --prefix apps/client-web run typecheck
```

Results:

- Nav preflight: `PASS` (0 blocking anchor issues)
- Contracts: `All contract validations passed`
- Client typecheck: `PASS`

## Outcome

- POI zones now have clearer physical context (inbox/task board/delivery each has dedicated prop presence).
- Walk-to-interact reliability remains intact after placement changes.
- Scene remains contract-valid and ready for downstream affordance walkthrough (`bd-ejin`).
