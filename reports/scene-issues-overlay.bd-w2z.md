# Scene Issues Overlay + Load-Order Policy (bd-w2z)

Generated: 2026-02-15T13:24:00Z

## Objective

Expose provider progress/issues in a lightweight, actionable overlay surface while enforcing and documenting the runtime asset loading-order policy (`shell -> critical -> decor`).

## Changes

### 1) Structured Scene Runtime surface in overlay (non-debug-only)

Updated `apps/client-web/src/overlay/OverlayRoot.tsx`:
- Added `Scene Runtime` summary card in the left overlay panel (always visible, non-intrusive).
- Surface now includes:
  - provider status + progress phase/percent/label
  - load-policy progress summary (`shell -> critical -> decor` with loaded/total counts)
  - top provider issues (up to 3) with per-issue action hints
  - explicit `Reload Scene Runtime` action wired to `sceneRuntime.reloadScene()`
- Existing debug HUD provider diagnostics remain for deep debug context.

### 2) Provider load-order policy enforcement

Updated `apps/client-web/src/scene/runtime/SceneRuntimeProvider.ts`:
- Added `classifySceneObjectLoadBucket(object)` with buckets:
  - `critical`
  - `decor`
- Implemented deterministic load plan before runtime asset load:
  - shell first (existing invariant)
  - critical objects next
  - decor objects last
  - deterministic ordering inside each bucket by `object.id`
- Applied ordered manifest to runtime load path (`loadSceneFromManifest(...)`).

### 3) Policy-aware issue telemetry

Updated provider warning payload for object load warnings:
- issue code remains `asset_object_load_warnings`
- warning details now include:
  - `loadOrderPolicy: shell_critical_decor`
  - critical/decor missing counts
  - missing object id lists per bucket
- warning message now includes missing-by-bucket summary for faster triage.

### 4) Console-noise reduction

Updated `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`:
- nav anchor validation warnings are now console-emitted only when debug HUD is explicitly enabled.
- primary diagnostics path is now structured overlay/provider issue surfaces.

### 5) Documentation update

Updated `docs/scene-runtime-provider-api.md`:
- documented `bd-w2z` overlay behavior
- documented `shell -> critical -> decor` policy semantics and deterministic ordering
- documented policy telemetry fields and console-noise expectations

## Acceptance Mapping

1. Overlay surfaces actionable issues and progress states: ✅
2. Loading order policy is implemented and documented: ✅
3. Console noise is reduced in favor of structured surface: ✅

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix contracts run validate
```

Results:
- typecheck: pass
- build: pass
- contracts validate: pass
