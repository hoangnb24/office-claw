# `bd-2iss` Runtime Instance-Group Batching

## Summary

Moved instance-group batching into the runtime provider pipeline so batching decisions are computed once per runtime load and consumed by `OfficeScene` from provider-derived state.

## Delivered

1. `apps/client-web/src/scene/runtime/SceneRuntimeProvider.ts`
   - Added provider-derived instancing fields:
     - `derived.instancedAssembly` (canonical batching result)
     - `derived.instancingStats` (group/object/exclusion counts + `estimatedDrawCallSavings`)
   - Added runtime attachment step after asset load:
     - builds instanced groups from runtime-loaded objects + manifest specs
     - keeps strict compatibility/fallback behavior through existing assembly module

2. `apps/client-web/src/scene/runtime/index.ts`
   - Exported `SceneRuntimeInstancingStats` type.

3. `apps/client-web/src/scene/OfficeScene.tsx`
   - Removed local ad-hoc `buildInstancedObjectGroups(...)` recomputation.
   - Consumes provider-derived `snapshot.derived.instancedAssembly` as the single batching source.
   - Keeps fallback rendering path from `fallbackObjectIds` unchanged.

4. Docs
   - `docs/instanced-mesh-assembly.md`
   - `docs/scene-runtime-provider-api.md`
   - Updated to reflect provider-owned batching + telemetry surface.

5. Scene activation for real grouping
   - `assets/scenes/cozy_office_v0.scene.json`
   - Added two non-interactive repeated decor props sharing `instance_group: decor_cone_cluster`:
     - `decor_cone_cluster_a`
     - `decor_cone_cluster_b`
   - `apps/client-web/public/scenes/cozy_office_v0.scene.json` synced via `node tools/sync-runtime-assets.mjs`.

## Acceptance Mapping

1. Instance grouping works for repeated assets
   - Grouping now runs from runtime-loaded objects/specs in provider load completion, not per-scene ad hoc recompute.
   - Scene now contains an explicit repeated eligible pair (`decor_cone_cluster_*`) for runtime batching activation.
2. Draw call reduction is measurable in telemetry
   - Provider now emits `instancingStats.estimatedDrawCallSavings` and related counts on `snapshot.derived`.
3. Visual correctness is preserved
   - Existing strict exclusion/fallback rules are unchanged; `OfficeScene` still renders fallback objects from `fallbackObjectIds`.

## Validation

1. `npm --prefix apps/client-web run typecheck` ✅
2. `npm --prefix apps/client-web run build` ✅
3. `agent-browser` runtime smoke on `http://127.0.0.1:4173` ✅
   - App loads successfully with provider/runtime path active.
   - No browser runtime errors surfaced during load smoke.
4. Candidate activation sanity check (`node` manifest scan with instancing compatibility filters) ✅
   - detected group key:
     - `decor_cone_cluster|/assets/blocker_cone.glb|false|false|` => `decor_cone_cluster_a,decor_cone_cluster_b`

## Evidence

- Runtime smoke screenshots:
  - `reports/client-polish/instancing-batching/20260215T134112Z/runtime-smoke.png`
  - `reports/client-polish/instancing-batching/20260215T134548Z/runtime-loaded-post-instance-group.png`
