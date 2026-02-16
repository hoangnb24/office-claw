# `bd-qg4i` Render Policy Controls

## Summary

Implemented manifest-driven object render policy controls and wired them into runtime rendering.

## Delivered

1. `contracts/schemas/scene-manifest.schema.json`
   - Added `render_policy` schema for `objects[]` with:
     - `cast_shadow` (`boolean`)
     - `receive_shadow` (`boolean`)
     - `cull_distance_m` (`number > 0`)

2. `apps/client-web/src/scene/loader/SceneLoader.ts`
   - Added typed `SceneObjectRenderPolicy`.
   - Added parse validation for `render_policy` fields.
   - Preserved parsed policy on `SceneObjectSpec`.

3. `apps/client-web/src/scene/OfficeScene.tsx`
   - Applies shadow policy recursively to loaded object meshes.
   - Applies optional camera-distance culling (`cull_distance_m`) per object.
   - Applies shadow policy defaults to fallback meshes.
   - Defaults are conservative when policy is omitted (`cast/receive=true`, no distance cull).

4. `assets/scenes/cozy_office_v0.scene.json`
   - Added `render_policy` entries to current object set for runtime validation.

5. Docs
   - Added `docs/manifest-render-policy.md` (authoring semantics + example).
   - Updated `docs/scene-runtime-provider-api.md` with render-policy behavior note.

## Validation

1. `npm --prefix apps/client-web run typecheck` ✅
2. `npm --prefix apps/client-web run build` ✅
3. `npm --prefix contracts run validate` ✅

## Notes

- Policy is object-scoped and optional.
- Behavior remains backward-compatible when `render_policy` is absent.
