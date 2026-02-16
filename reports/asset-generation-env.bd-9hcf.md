# Sprint A Environment Meshy Generation (`bd-9hcf`)

Date: 2026-02-15  
Agent: HazyEagle

## Scope
Generate/validate Sprint A environment GLBs with live Meshy evidence and wire them into canonical runtime asset paths.

Target asset IDs:
1. `office_shell`
2. `prop_inbox`
3. `prop_task_board`
4. `prop_delivery_shelf`
5. `prop_dev_desk`
6. `prop_blocker_cone`

## Meshy Evidence Manifests
1. `reports/meshy-office_shell-manifest.json`
2. `reports/meshy-prop_inbox-manifest.json`
3. `reports/meshy-prop_task_board-manifest.json`
4. `reports/meshy-prop_delivery_shelf-manifest.json`
5. `reports/meshy-prop_dev_desk-manifest.json`
6. `reports/meshy-prop_blocker_cone-manifest.json`

## Additional Generation Run Completed in This Pass
Missing cone manifest/generation was completed via live Meshy text-to-3d:
- task id: `019c6215-12a5-792a-9f53-03c2ece0f1cb`
- endpoint: `/openapi/v2/text-to-3d`
- downloaded asset: `assets/glb/prop_blocker_cone_text_generated.glb`
- status evidence: `reports/client-polish/meshy/bd-9hcf/20260215T161630Z/prop_blocker_cone_text_status.json`

## Canonical Runtime Asset Wiring
Canonical files were updated to generated outputs:
1. `assets/glb/office_shell.glb` <= `assets/glb/office_shell_generated.glb`
2. `assets/glb/inbox.glb` <= `assets/glb/prop_inbox_generated.glb`
3. `assets/glb/task_board.glb` <= `assets/glb/prop_task_board_generated.glb`
4. `assets/glb/shelf.glb` <= `assets/glb/prop_delivery_shelf_generated.glb`
5. `assets/glb/desk.glb` <= `assets/glb/prop_dev_desk_text_generated.glb`
6. `assets/glb/blocker_cone.glb` <= `assets/glb/prop_blocker_cone_text_generated.glb`

Runtime mirrors synced:
- command: `npm --prefix apps/client-web run assets:sync`
- logs: `reports/client-polish/meshy/bd-9hcf/20260215T161630Z/assets-sync.stdout.txt`

## Hash Evidence (Canonical + Mirror)
Canonical and mirrored runtime assets match (same SHA1):
- `office_shell`: `c8fede9c519bd4dcb649f4340685953063f89a50`
- `prop_inbox`: `fbb37cac212ef09561f081c111ea785d6dd4e0f3`
- `prop_task_board`: `07e314cfcb4ed7715ab2f7252ff00d01d70ec3f6`
- `prop_delivery_shelf`: `6403ab7276aafa9245daa97c91cd922d22dd00e1`
- `prop_dev_desk`: `74cbbbe13d9f9c2f83d5aeb25b234ac35924e343`
- `prop_blocker_cone`: `dced45df5f27f3ccdcb375fc256ece32aa98d63e`

## Validation
1. GLB preflight:
- `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.bd-9hcf.md`
- result: pass

2. Provenance strict gate snapshot:
- `node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md`
- result: fails only on agent-track manifests (`bd-18j1`), not on env assets from `bd-9hcf`.

## Acceptance Mapping (`bd-9hcf`)
1. Required Sprint A env IDs have live Meshy output GLBs under `assets/glb/`: met.
2. Each generated env asset has a `reports/meshy-<asset_id>-manifest.json`: met.
3. Generated env GLBs are no longer hash-identical to known placeholder clusters: met.
4. Work-order/regeneration notes documented: met (this report + per-asset manifests).

## Notes
- User explicitly approved proceeding after confirming text-to-3d desk generation/runtime path functionality.
- `bd-18j1` remains separate for agent skeleton/animation live-manifest completion.
