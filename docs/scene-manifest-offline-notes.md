# Scene Manifest Offline Notes

Related bead: `bd-bg2`

## What was updated
- `assets/scenes/cozy_office_v0.scene.json` now references local GLBs that exist in-repo:
  - `assets/glb/office_shell.glb`
  - `assets/glb/shelf.glb`
  - `assets/glb/desk.glb`
- POI/object `highlight_nodes` were aligned to node names present in currently available placeholder assets.

## Why placeholders are used
- Full v0 prop pack is still maturing, so placeholder GLBs were used to keep the scene manifest runnable for offline loop development (M0-M2) while preserving POI/interactable wiring.

## Offline loop coverage
- Required POIs remain present (`inbox`, `task_board`, `delivery_shelf`).
- Interactable objects remain mapped to POIs and interaction types.
- Spawns, collision blocks, and nav grid remain populated for initial movement/interactions.

## Validation run
Command:
```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```

Observed result:
- Manifest asset-reference errors resolved.
- Highlight-node reference errors resolved for current scene hooks.
- Remaining errors are expected clip-contract gaps in current agent GLBs (`Idle`, `Walk`, `Work_Typing`, `Think` naming mismatch), tracked for asset remediation.
