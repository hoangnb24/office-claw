# Runtime Meshy Desk Validation (`bd-28zr`)

Date: 2026-02-15  
Agent: HazyEagle

## Objective
Verify whether a Meshy text-to-3d generated desk GLB works in OfficeClaw runtime before bulk asset generation.

## Repro Baseline
Initial spike state showed:
- Generated desk GLB existed and synced, but overlay displayed:
  - `Startup assets: 0/0 loaded=0 failed=0`
- Scene Runtime was loaded, yet startup telemetry was inconclusive for validating asset load health.

Artifacts:
- `reports/meshy-text2desk-spike.bd-9hcf.md`
- `reports/meshy-prop_dev_desk-text-manifest.json`
- `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/`

## Root Cause
`Startup assets` telemetry in overlay was still driven by legacy `useSceneAssets` store updates, while runtime now loads scene assets through `SceneRuntimeProvider`.

Result: metrics stayed at zero despite provider-managed scene loads.

## Fix Implemented
File:
- `apps/client-web/src/scene/runtime/SceneRuntimeProvider.ts`

Change summary:
1. Bridge provider-managed load flow to `worldStore.assetStartup`.
2. Call `beginAssetStartup(1 + manifest.objects.length)` before provider asset load.
3. On success, mark shell/object assets loaded or failed based on loaded object IDs.
4. On fatal asset load failure, mark startup as failed explicitly for shell.

## Validation

### A) Cozy scene startup telemetry now reflects real load plan
- Observed text:
  - `Startup assets: 8/8 loaded=8 failed=0`
- Evidence:
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/fix-startup-assets-text.txt`
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/desk-render-after-startup-fix.png`

### B) Generated desk GLB renders in-game (probe scene)
To isolate visibility from current placeholder office shell assets, a probe scene was added:
- `assets/scenes/desk_probe_v0.scene.json`

Probe run:
- `VITE_SCENE_ID=desk_probe_v0`
- Observed:
  - `Startup assets: 1/1 loaded=1 failed=0`
  - visible desk model in rendered scene capture
- Evidence:
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/probe-startup-assets-text-scaled.txt`
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/desk-probe-render-scaled.png`
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/probe-snapshot-scaled.txt`

### C) GLB quality/compat checks
- `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/glb-preflight-textdesk.md`
  - Result: pass, no errors.

### D) Build/type safety
- `npm --prefix apps/client-web run typecheck` passed.
- `npm --prefix apps/client-web run build` passed.

## Recommendation
Proceed with controlled asset generation after curated refs are ready:
1. Keep the telemetry bridge in place (it resolves the `0/0` blind spot).
2. Use the probe-scene pattern for first-pass visibility validation of newly generated assets when base environment assets are placeholders.
3. Continue `bd-9hcf` only after user-provided curated images are in `assets/images/`.
