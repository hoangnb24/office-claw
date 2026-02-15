# Asset Loading Resilience (bd-hgb)

This document describes the client behavior for startup asset loading progress and failure handling.

## Startup progress behavior

- Asset startup begins from `sceneAssetCatalog` in `apps/client-web/src/scene/assets/sceneAssetCatalog.ts`.
- `useSceneAssets` updates `worldStore.assetStartup` with:
  - total assets
  - loaded count
  - failed count
  - critical failure count
  - last error message
- `OverlayRoot` shows live startup progress and connection-safe status text.

## Failure handling rules

- Critical assets (`critical: true`):
  - do not silently degrade
  - show explicit recovery guidance in overlay
  - keep world loop alive so user can still inspect state

- Non-critical assets (`critical: false`):
  - render fallback placeholder geometry if load fails
  - continue interaction/render loop without hard crash
  - show warning that placeholders are active

## Integration points

- `apps/client-web/src/scene/assets/useSceneAssets.ts`
  - asset startup orchestration
  - load success/failure accounting
- `apps/client-web/src/scene/OfficeScene.tsx`
  - loaded asset render primitives
  - non-critical fallback meshes
- `apps/client-web/src/overlay/OverlayRoot.tsx`
  - user-facing progress, warning, and critical recovery guidance

## Manual checks

1. Start with missing `/assets/*.glb` files: app should render fallback objects for non-critical props and show a critical warning for shell failure.
2. Add valid glb files at catalog paths and refresh: progress should reach full loaded state and warnings should clear.
3. Confirm no hard runtime crash in either scenario.
