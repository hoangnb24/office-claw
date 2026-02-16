# Nav/Focus/Highlight Provider Bundle Migration (bd-3ln)

Generated: 2026-02-15T13:20:00Z

## Objective

Migrate local nav, focus, and highlight subsystems away from static manifest imports and onto the shared `SceneRuntimeProvider` snapshot/derived bundle so all systems consume one canonical runtime source.

## Changes

### 1) Highlight nodes now come from provider-derived data

Updated highlight manifest helper and consumer wiring:
- `apps/client-web/src/scene/highlight/poiHighlightManifest.ts`
  - replaced static JSON import with pure helper:
  - `buildPoiHighlightNodesById(pois, objects)`
- `apps/client-web/src/scene/highlight/useHighlightManager.ts`
  - now reads `snapshot.derived?.poiHighlightNodesById`
- `apps/client-web/src/scene/highlight/index.ts`
  - exports helper instead of static map singleton

### 2) Focus config now comes from provider-derived data

Updated focus helper and camera rig wiring:
- `apps/client-web/src/scene/focus/poiFocusManifest.ts`
  - replaced static JSON import with helpers:
  - `toPoiFocusConfig(poi)`
  - `buildPoiFocusConfigById(pois)`
- `apps/client-web/src/scene/camera/IsometricCameraRig.tsx`
  - now reads `snapshot.derived?.poiFocusConfigById`

### 3) Navigation now consumes provider manifest + derived nav bundle

Updated `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`:
- removed static manifest import/state and local recomputation of nav grid/collider blockers/anchor validation.
- now consumes:
  - `snapshot.manifest`
  - `snapshot.derived?.navigationGrid`
  - `snapshot.derived?.navAnchorIssues`
  - `snapshot.derived?.poisById`
- hot reload (`R` in nav authoring mode) now delegates to `reloadScene()`.
- added provider-not-ready guards:
  - nav debug reflects `navReady: false` when manifest/grid unavailable
  - command intents are safely blocked with reason `nav_grid_unavailable` if grid is missing
  - blocked-cell overlay only renders when nav grid exists

## Acceptance Mapping

1. Nav/focus/highlight no longer import static manifest singleton: ✅
2. Shared provider derived bundle is the canonical runtime source: ✅
3. Existing nav panel routing behavior is preserved (manifest panel first + compatibility fallback): ✅

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
