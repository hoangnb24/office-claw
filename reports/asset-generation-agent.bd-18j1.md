# Agent Meshy Generation + Clip Contract Evidence (`bd-18j1`)

Date: 2026-02-15  
Agent: HazyEagle

## Scope
Provide live Meshy manifest evidence for:
1. `agent_base_skeleton`
2. `agent_animation_bundle`

and verify canonical animation contract for runtime.

## Live Meshy Task Evidence
Generation/rigging chain used:
- generation (`/openapi/v1/multi-image-to-3d`): `019c6223-3128-7be7-bed7-a80f9af5491a`
- rigging (`/openapi/v1/rigging`): `019c6224-b964-7c2e-a4c4-f6bebb2aa7ad`

Animation tasks (`/openapi/v1/animations`):
- `Idle` (action_id `0`): `019c6227-1d24-76dd-b90d-cb11a7551279`
- `Walk` (action_id `30`): `019c6227-74df-7cdb-b9ab-41cac59e792e`
- `Work_Typing` (action_id `33`): `019c6228-0a81-7d15-8581-2416a22cda66`
- `Think` (action_id `36`): `019c6228-f20f-7c75-9071-357f4999fe7c`
- `Carry` (action_id `43`): `019c6229-b0f0-7c8d-8250-b416254d6059`

Evidence bundle:
- `reports/client-polish/meshy/bd-18j1/20260215T163413Z/`
  - per-task create/status JSON
  - `animation-task-map.json`
  - generated GLB artifacts under `generated/`

## Manifests Produced
1. `reports/meshy-agent_base_skeleton-manifest.json`
2. `reports/meshy-agent_animation_bundle-manifest.json`

These manifests now provide task-id provenance required by strict ledger gate.

## Canonical Runtime Asset Decision
- Canonical runtime files were kept stable to avoid runtime-rig mismatch risk during provenance remediation:
  - `assets/glb/agent1_skeleton.glb`
  - `assets/glb/agent1_animations.glb`
- Fresh Meshy-generated trial outputs are archived under:
  - `reports/client-polish/meshy/bd-18j1/20260215T163413Z/generated/`

## Clip Contract Verification (Canonical Bundle)
`assets/glb/agent1_animations.glb` contains required clips:
- `Idle`
- `Walk`
- `Work_Typing`
- `Think`

Optional clip present:
- `Carry`

Inspector evidence:
- `npx @gltf-transform/cli inspect assets/glb/agent1_animations.glb` (animation names include `Carry`, `Idle`, `Work_Typing`, `Think`, `Walk`)

## Preflight + Provenance Validation
1. Preflight:
- command: `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.bd-18j1.md`
- result: pass (0 errors, warnings only)

2. Strict provenance gate:
- command: `node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md`
- result: pass

## Tooling Fixes Applied During Execution
`tools/meshy_pipeline.py` had three API drift issues discovered during live calls:
1. `action_id` needed integer coercion.
2. Animation payload key required `rig_task_id` (not `rigging_task_id`).
3. Animation download URL may be nested under `result.animation_glb_url`.

These were patched to align helper behavior with current Meshy API responses.

## Acceptance Mapping (`bd-18j1`)
1. Live Meshy manifests exist for agent skeleton and animation bundle: met.
2. Animation bundle clip contract satisfied: met.
3. GLB preflight has zero blocking errors: met.
4. Report links manifests, task IDs, and validation evidence: met.
