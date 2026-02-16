# Client Art Production List (Cozy Office Polish)

Last updated: 2026-02-15

## Purpose

Define the complete art scope for client polish so implementation can proceed without ambiguity.

This list is the source of truth for:
1. What assets must be produced.
2. Which files/IDs the client expects.
3. Which POIs/interactions each asset supports.
4. What quality/contract checks are required before integration.

## Scope Levels

1. `P0` Required for immediate polished client (current offline flow).
2. `P1` Required to align with full v0 POI design from `PLAN.md`.
3. `P2` Optional polish/decor depth after core world looks complete.

---

## Art Direction Brief (Locked for `bd-4in`)

### Approved Reference Set

These references are approved for this phase and should be treated as the canonical style anchors:

| Ref ID | File | Intent | What to preserve |
|---|---|---|---|
| `R-AGENT-FRONT` | `images/agent_front.jpeg` | front silhouette + face readability | warm hand-painted texture, rounded friendly proportions, soft linework |
| `R-AGENT-BACK` | `images/agent_back.jpeg` | back-view clothing structure | suspenders/trouser silhouette, gentle fabric folds, non-photoreal paint treatment |
| `R-AGENT-TURNAROUND` | `images/agent.jpeg` | full turnaround consistency | front/back proportion parity and palette continuity |
| `R-WORLD-V0-MANIFEST` | `assets/scenes/cozy_office_v0.scene.json` | canonical scene semantics | cozy office POI layout and interaction-first object hierarchy |

Reference policy:
1. Character style follows `R-AGENT-*` anchors.
2. Environment style follows the same paint language so agents and props look authored in one world.
3. If a generated asset diverges from these anchors, regenerate instead of "fixing in runtime."

### Style Decisions (Explicit Targets)

Palette and mood:
1. Base palette: warm neutrals (`oak`, `linen`, `slate`, `dusty olive`) with restrained accent colors.
2. Saturation target: low-to-medium for large surfaces; medium accents only on interactables.
3. Contrast target: enough edge separation at isometric distance without neon glow or heavy rim lights.

Material model:
1. Semi-stylized painterly surfaces, not hard PBR realism.
2. Wood and fabric should show subtle brush/noise breakup.
3. Metals should be muted and matte; avoid chrome or mirror finishes.

Lighting tone:
1. Cozy late-afternoon indoor read: warm key + gentle cool fill.
2. Avoid dramatic noir shadows or high-contrast directional streaking.
3. POI props need local readability under current runtime light budget.

Clutter density:
1. Gameplay lanes and POI anchors stay clear and readable.
2. Decorative clutter is grouped at perimeter and secondary surfaces.
3. No large decor object can occlude task board, inbox, or delivery shelf interaction silhouettes.

### Style Boundaries and Non-Goals

Do:
1. Keep silhouettes simple and readable from orthographic/isometric camera distance.
2. Prefer broad value grouping over tiny texture detail.
3. Keep proportions slightly stylized and friendly rather than strictly realistic.

Do not:
1. Use photoreal scan look, grunge-heavy textures, or high-frequency noise.
2. Introduce cyberpunk neon, glossy black materials, or industrial-harsh lighting.
3. Add prop clutter that interferes with nav paths, POI hit targets, or highlight-node visibility.

### Asset Generation Prompt Contract (Use in Meshy Work Orders)

Use this as the default brief prefix for office environment assets:

`Semi-stylized cozy office diorama, hand-painted texture language, warm neutral palette, matte materials, soft readable silhouettes from isometric camera, interaction-friendly spacing, no photorealism, no neon, no heavy grime.`

Use this as the default brief prefix for character assets:

`Friendly stylized office specialist matching reference turnaround, clean silhouette, subtle hand-painted shading, warm-neutral wardrobe with restrained accent colors, rig-ready topology, readable at medium distance.`

---

## Asset Inventory Lock and ID Map (`bd-126`)

This section is the canonical lock for asset IDs and their runtime mapping contract.

### ID stability rules

1. `asset_id` is immutable once introduced.
2. If geometry/style changes, keep the same `asset_id`; only bump file version/manifests.
3. If semantics change (different POI role), create a new `asset_id` and deprecate the old one.
4. Runtime should resolve served URLs under `/assets/**` (see `bd-h10` path policy).

### Canonical mapping table

| Tier | Asset ID | Authoring Source | Runtime Served URL | Current Runtime Alias (if any) | POI / Interaction |
|---|---|---|---|---|---|
| P0 | `office_shell` | `assets/glb/office_shell.glb` | `/assets/office_shell.glb` | `apps/client-web/public/assets/office_shell.glb` | world shell |
| P0 | `prop_inbox` | `assets/glb/inbox.glb` | `/assets/inbox.glb` | `apps/client-web/public/assets/inbox.glb` (legacy `/assets/props/inbox.glb` deprecated) | `poi_reception_inbox` |
| P0 | `prop_task_board` | `assets/glb/task_board.glb` | `/assets/task_board.glb` | `apps/client-web/public/assets/task_board.glb` (legacy `/assets/props/task_board.glb` deprecated) | `poi_task_board` |
| P0 | `prop_delivery_shelf` | `assets/glb/shelf.glb` | `/assets/shelf.glb` | `apps/client-web/public/assets/shelf.glb` (legacy `/assets/props/delivery_shelf.glb` deprecated) | `poi_delivery_shelf` |
| P0 | `prop_dev_desk` | `assets/glb/desk.glb` | `/assets/desk.glb` | `apps/client-web/public/assets/desk.glb` (legacy `/assets/props/dev_desk.glb` deprecated) | workstation context |
| P0 | `prop_blocker_cone` | `assets/glb/blocker_cone.glb` | `/assets/blocker_cone.glb` | `apps/client-web/public/assets/blocker_cone.glb` (legacy `/assets/props/blocker_cone.glb` deprecated) | blocker signaling |
| P0 | `agent_base_skeleton` | `apps/client-web/public/assets/agent1_skeleton.glb` | `/assets/agent1_skeleton.glb` | legacy `/assets/agents/agent1_skeleton.glb` deprecated | agent runtime mesh |
| P0 | `agent_animation_bundle` | `apps/client-web/public/assets/agent1_animations.glb` | `/assets/agent1_animations.glb` | legacy `/assets/agents/agent1_animations.glb` deprecated | agent clip bundle |
| P1 | `poi_meeting_table_set` | `assets/glb/meeting_table.glb` | `/assets/meeting_table.glb` | none | `poi_meeting_table` |
| P1 | `poi_research_desk_set` | `assets/glb/research_desk.glb` | `/assets/research_desk.glb` | none | `poi_research_desk_1` |
| P1 | `poi_dev_desk_set` | `assets/glb/dev_desk.glb` | `/assets/dev_desk.glb` | none | `poi_dev_desk_1` |
| P1 | `poi_lounge_set` | `assets/glb/lounge_corner.glb` | `/assets/lounge_corner.glb` | none | `poi_lounge` |
| P1 | `task_board_wall_context` | `assets/glb/task_board_wall.glb` | `/assets/task_board_wall.glb` | none | `poi_task_board` |
| P1 | `inbox_reception_context` | `assets/glb/reception_desk.glb` | `/assets/reception_desk.glb` | none | `poi_reception_inbox` |
| P1 | `delivery_zone_context` | `assets/glb/delivery_zone.glb` | `/assets/delivery_zone.glb` | none | `poi_delivery_shelf` |
| P1 | `agent_bd_variant` | `assets/glb/agent_bd.glb` | `/assets/agent_bd.glb` | none | character variant |
| P1 | `agent_research_variant` | `assets/glb/agent_research.glb` | `/assets/agent_research.glb` | legacy archive path may appear in historical reports | character variant |
| P1 | `agent_eng_variant` | `assets/glb/agent_eng.glb` | `/assets/agent_eng.glb` | none | character variant |
| P2 | `plant_set_small` | `assets/glb/plant_small.glb` | `/assets/plant_small.glb` | none | decor |
| P2 | `plant_set_large` | `assets/glb/plant_large.glb` | `/assets/plant_large.glb` | none | decor |
| P2 | `books_stack` | `assets/glb/books_stack.glb` | `/assets/books_stack.glb` | none | decor |
| P2 | `wall_frames` | `assets/glb/wall_frames.glb` | `/assets/wall_frames.glb` | none | decor |
| P2 | `coffee_station` | `assets/glb/coffee_station.glb` | `/assets/coffee_station.glb` | none | decor |
| P2 | `rug_set` | `assets/glb/rug_set.glb` | `/assets/rug_set.glb` | none | decor |
| P2 | `ambient_lamp_set` | `assets/glb/ambient_lamps.glb` | `/assets/ambient_lamps.glb` | none | decor |
| P2 | `misc_clutter_pack` | `assets/glb/clutter_pack_a.glb` | `/assets/clutter_pack_a.glb` | none | decor |

### Change-management rule for new assets

When adding a new asset:
1. Add one row in this table with locked `asset_id`, source path, and served URL.
2. Update scene manifest references in `assets/scenes/cozy_office_v0.scene.json`.
3. If legacy runtime alias paths are needed for compatibility, record them explicitly.

### Path migration note (2026-02-16)

Canonical runtime URLs must use root-served assets:
1. `/assets/inbox.glb` (not `/assets/props/inbox.glb`)
2. `/assets/task_board.glb` (not `/assets/props/task_board.glb`)
3. `/assets/shelf.glb` (not `/assets/props/delivery_shelf.glb`)
4. `/assets/desk.glb` (not `/assets/props/dev_desk.glb`)
5. `/assets/blocker_cone.glb` (not `/assets/props/blocker_cone.glb`)
6. `/assets/agent1_skeleton.glb` and `/assets/agent1_animations.glb` (not `/assets/agents/*`)

Legacy grouped URLs are historical-only and non-canonical.

---

## A) Runtime-Critical Replacement Set (Exact Current Filenames)

These files are already referenced by current client code and should be replaced first with final art.

| Priority | Asset ID | Runtime File (Current Path) | Current State | Target Purpose |
|---|---|---|---|---|
| P0 | `office_shell` | `apps/client-web/public/assets/office_shell.glb` | placeholder | full room shell, walls, floor, structural fixtures |
| P0 | `prop_inbox` | `apps/client-web/public/assets/inbox.glb` | placeholder | reception inbox interactable |
| P0 | `prop_task_board` | `apps/client-web/public/assets/task_board.glb` | placeholder | task board interactable |
| P0 | `prop_delivery_shelf` | `apps/client-web/public/assets/shelf.glb` | placeholder | delivery shelf interactable |
| P0 | `prop_dev_desk` | `apps/client-web/public/assets/desk.glb` | placeholder | workstation prop |
| P0 | `prop_blocker_cone` | `apps/client-web/public/assets/blocker_cone.glb` | placeholder | blocker marker/hazard prop |

Notes:
1. Replacing these files immediately improves visuals with minimal code churn.
2. Current canonical runtime URLs are driven by `assets/scenes/cozy_office_v0.scene.json`.

---

## B) Manifest-Driven World Set (Full v0 POI Coverage)

These assets complete the intended POI world model in `PLAN.md` and `POI_AND_INTERACTIONS.md`.

| Priority | Asset ID | Proposed Source File (`assets/glb`) | POI / System | Interaction Role |
|---|---|---|---|---|
| P1 | `poi_meeting_table_set` | `assets/glb/meeting_table.glb` | `poi_meeting_table` | kickoff/review ceremony anchor |
| P1 | `poi_research_desk_set` | `assets/glb/research_desk.glb` | `poi_research_desk_1` | research work area |
| P1 | `poi_dev_desk_set` | `assets/glb/dev_desk.glb` | `poi_dev_desk_1` | engineering work area |
| P1 | `poi_lounge_set` | `assets/glb/lounge_corner.glb` | `poi_lounge` | blocker/decision rendezvous |
| P1 | `task_board_wall_context` | `assets/glb/task_board_wall.glb` | `poi_task_board` | board wall + context dressing |
| P1 | `inbox_reception_context` | `assets/glb/reception_desk.glb` | `poi_reception_inbox` | reception desk where inbox sits |
| P1 | `delivery_zone_context` | `assets/glb/delivery_zone.glb` | `poi_delivery_shelf` | shelf surroundings, lighting cues |

Notes:
1. Current manifest only has two object entries (`delivery_shelf`, `desk_01`), so this set requires manifest expansion.
2. These assets should be integrated via manifest runtime, not hardcoded object placement.

---

## C) Agent Character and Animation Set

| Priority | Asset ID | Target File | Requirement |
|---|---|---|---|
| P0 | `agent_base_skeleton` | `apps/client-web/public/assets/agent1_skeleton.glb` | production skeleton mesh, stable rig |
| P0 | `agent_animation_bundle` | `apps/client-web/public/assets/agent1_animations.glb` | canonical clips required |
| P1 | `agent_bd_variant` | `assets/glb/agent_bd.glb` | visual identity variant (optional if tint/material variant used) |
| P1 | `agent_research_variant` | `assets/glb/agent_research.glb` | visual identity variant |
| P1 | `agent_eng_variant` | `assets/glb/agent_eng.glb` | visual identity variant |

Required clip names (contract):
1. `Idle`
2. `Walk`
3. `Work_Typing`
4. `Think`
5. `Carry` (optional)

---

## D) Decorative and Atmosphere Set

These are not strictly required for interaction logic, but strongly affect perceived polish.

| Priority | Asset ID | Proposed File | Placement Intent |
|---|---|---|---|
| P2 | `plant_set_small` | `assets/glb/plant_small.glb` | corners, desk-side life |
| P2 | `plant_set_large` | `assets/glb/plant_large.glb` | lobby/lounge anchors |
| P2 | `books_stack` | `assets/glb/books_stack.glb` | shelf and desks |
| P2 | `wall_frames` | `assets/glb/wall_frames.glb` | break flat wall surfaces |
| P2 | `coffee_station` | `assets/glb/coffee_station.glb` | lounge/reception flavor |
| P2 | `rug_set` | `assets/glb/rug_set.glb` | zone definition for cozy tone |
| P2 | `ambient_lamp_set` | `assets/glb/ambient_lamps.glb` | warm localized lighting cues |
| P2 | `misc_clutter_pack` | `assets/glb/clutter_pack_a.glb` | controlled visual density |

---

## E) Node Naming Contract for Interactions/Highlights

Interactive assets should include stable node names so `highlight_nodes` remain durable across revisions.

Suggested required node names by POI:
1. Inbox:
- `InboxTray`
- `ReceptionDesk`
2. Task board:
- `TaskBoardWall`
- `StickyBoardFrame`
3. Delivery shelf:
- `ShelfFrame`
- `ShelfTop`
4. Meeting table:
- `MeetingTable`
5. Research desk:
- `ResearchDeskSurface`
6. Dev desk:
- `DevDeskSurface`
7. Lounge:
- `LoungeSeatCluster`

If final node names differ, update manifest `highlight_nodes` in the same PR.

---

## F) Collider + Nav Authoring Requirements

For each interactable/static blocker asset:
1. Provide intended collider type (`box` for v0).
2. Provide collider size and offset candidate values.
3. Verify nav anchors are not on blocked cells.

Per asset deliver with:
1. visual GLB
2. collider recommendation (size/offset)
3. nav anchor recommendation (if POI-linked)

---

## G) Quality and Budget Targets (Per Asset)

Minimum acceptance checks:
1. Parses successfully in GLTFLoader.
2. Correct scale/pivot (1 unit = 1 meter; no extreme armature scale drift unless justified).
3. Texture/material quality acceptable at isometric camera distance.
4. Does not break frame budget when combined in scene.

Animation assets additionally must:
1. pass canonical clip checks (or be normalized before runtime use).

---

## H) Production Workflow (Meshy + Validation)

For each asset batch:

1. Build work order:
```bash
python3 /Users/themrb/.codex/skills/meshy-glb-from-spec/scripts/build_meshy_work_order.py \
  --project-root /Users/themrb/Documents/personal/officeclaw \
  --image <ref1> --image <ref2> \
  --asset-id <asset_id> \
  --out reports/meshy-work-order-<asset_id>.md
```

2. Meshy generation:
```bash
python tools/meshy_pipeline.py --image <ref1> --image <ref2> --asset-id <asset_id> --dry-run
python tools/meshy_pipeline.py --image <ref1> --image <ref2> --asset-id <asset_id> --output-dir assets/glb --manifest-out reports/meshy-<asset_id>-manifest.json
```

3. Normalize clips (agents only):
```bash
node tools/glb-normalize-clips.mjs --in assets/glb/<asset_id>_animations.glb
```

4. Preflight:
```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```

5. Runtime integration:
1. update manifest URLs and interaction metadata.
2. update client runtime asset path strategy if needed.
3. run visual QA checklist.

---

## I) Integration Mapping (What Code/Data Changes with Art)

Primary files likely touched:
1. `assets/scenes/cozy_office_v0.scene.json`
2. `apps/client-web/src/scene/loader/SceneLoader.ts` (runtime URL contract checks)
3. `apps/client-web/src/scene/OfficeScene.tsx` (agent/runtime integration behaviors)
4. `apps/client-web/public/assets/**` (runtime-served source assets)
5. `apps/client-web/src/scene/assets/sceneAssetCatalog.ts` (legacy startup path references only, during transition)

---

## J) Ready-to-Implement Asset Backlog (Execution Order)

### Sprint A (must do first)
1. `office_shell`
2. `prop_inbox`
3. `prop_task_board`
4. `prop_delivery_shelf`
5. `prop_dev_desk`
6. `prop_blocker_cone`
7. `agent_base_skeleton`
8. `agent_animation_bundle`

### Sprint B (full v0 world semantics)
1. `poi_meeting_table_set`
2. `poi_research_desk_set`
3. `poi_dev_desk_set`
4. `poi_lounge_set`
5. `task_board_wall_context`
6. `inbox_reception_context`
7. `delivery_zone_context`

### Sprint C (atmosphere/depth)
1. `plant_set_small`
2. `plant_set_large`
3. `books_stack`
4. `wall_frames`
5. `coffee_station`
6. `rug_set`
7. `ambient_lamp_set`
8. `misc_clutter_pack`

---

## K) Done Criteria for Art Scope

Art scope is complete when:
1. Sprint A + Sprint B assets are delivered and integrated.
2. No placeholder critical world assets remain.
3. Interactable POIs are visually distinct and aligned with their panel function.
4. Preflight has no blocking errors.
5. Visual QA scenarios pass with polished look in offline mode.
