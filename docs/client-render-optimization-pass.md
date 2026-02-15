# Client Render Optimization Pass

Linked bead: `bd-2kr`

## Scope

- enforce practical renderer/light/shadow budgets
- reduce avoidable draw-call overhead in the highlight path
- keep behavior deterministic and compatible with existing interaction flows

## Implemented changes

### 1) Renderer and lighting budgets

- `apps/client-web/src/App.tsx`
  - set constrained renderer defaults:
    - `dpr={[1, 1.5]}`
    - `gl.antialias=false`
    - `gl.powerPreference="high-performance"`
    - `shadows` enabled
- `apps/client-web/src/scene/OfficeScene.tsx`
  - lighting limited to a fixed budget:
    - one ambient light
    - one hemisphere fill light
    - one directional key light with bounded shadow map/camera

### 2) Per-asset shadow budget enforcement

- `apps/client-web/src/scene/assets/sceneAssetCatalog.ts`
  - added explicit render budget metadata per asset:
    - `renderBudget.shadowCasters`
    - `renderBudget.shadowReceivers`
- `apps/client-web/src/scene/assets/useSceneAssets.ts`
  - applies those budgets while traversing cloned meshes during load
  - keeps shadow participation bounded even when GLB internals change

### 3) Selective instancing path

- `apps/client-web/src/scene/OfficeScene.tsx`
  - POI highlight marker rendering now uses `InstancedMesh` when there are multiple markers
  - single-marker behavior remains unchanged
  - this reduces repeated marker draw-call pressure while preserving visuals

## Notes and limits

- The pass targets deterministic low-risk improvements in the current client runtime path.
- Additional high-impact opportunities (large static-prop batching/instancing by manifest tags) are still possible, but were not introduced here to avoid interaction metadata regressions.

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
