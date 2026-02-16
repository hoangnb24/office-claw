# SceneRuntimeProvider Typed API (`bd-18t`, `bd-2lh0`, `bd-3ato`, `bd-319z`, `bd-1fec`, `bd-2mo`, `bd-qg4i`, `bd-w2z`, `bd-2iss`)

Last updated: 2026-02-15

## Goal

Define one typed provider contract for manifest-driven scene runtime data so `nav`, `focus`, and `highlight` stop depending on ad-hoc direct manifest imports.

## API Surface

Primary type module:
- `apps/client-web/src/scene/runtime/SceneRuntimeProvider.ts`

Re-export entrypoint:
- `apps/client-web/src/scene/runtime/index.ts`

Core contract objects:
1. `SceneRuntimeSnapshot`
2. `SceneRuntimeDerivedIndices`
3. `SceneRuntimeIssue`
4. `SceneRuntimeProviderValue`
5. `SceneRuntimeProviderProps`

## Data Responsibilities

`SceneRuntimeSnapshot` covers:
1. scene identity (`sceneId`, `manifestUrl`)
2. lifecycle state (`idle|loading|loaded|degraded|error`)
3. structured load progress (`phase`, `percent`, `label`)
4. canonical manifest payload
5. loaded runtime data (`SceneRuntimeData`)
6. derived indices for consumer systems
7. issue feed and update timestamp

`SceneRuntimeDerivedIndices` covers:
1. `poisById` and `objectsById`
2. `poiHighlightNodesById`
3. `poiFocusConfigById`
4. computed `navigationGrid`
5. `navAnchorIssues` diagnostics
6. `instancedAssembly` (runtime-loaded instance-group batching result)
7. `instancingStats` (`groupCount`, `instancedObjectCount`, `fallbackObjectCount`, `estimatedDrawCallSavings`, exclusion counts)

## Consumer Coverage

### Navigation (`LocalNavigationLayer`)

Requires:
1. manifest POIs and nav grid
2. object colliders
3. nav-anchor validation issues

Provider contract coverage:
1. `derived.poisById`
2. `derived.navigationGrid`
3. `derived.navAnchorIssues`
4. `derived.objectsById`

### Focus (`poiFocusManifest` / camera rig)

Requires:
1. per-POI focus point
2. panel anchor
3. camera framing offset/zoom

Provider contract coverage:
1. `derived.poiFocusConfigById`
2. `getPoiFocusConfig(poiId)`

### Highlight (`poiHighlightManifest` / highlight manager)

Requires:
1. stable highlight node mapping by POI

Provider contract coverage:
1. `derived.poiHighlightNodesById`
2. `getHighlightNodes(poiId)`

## Failure and Retry Semantics

Provider interface defines explicit control methods:
1. `loadScene(options)`
2. `reloadScene()`
3. `clearIssues()`

`bd-2lh0` implementation details:
1. Single-load guard: duplicate calls for the same `{sceneId, manifestUrl}` share one in-flight fetch promise.
2. Lifecycle cache: successfully fetched manifests are cached per `{sceneId, manifestUrl}` and reused on subsequent non-forced loads.
3. Explicit retry path:
- `loadScene({ ..., forceReload: true })` bypasses cache and refetches.
- `reloadScene()` triggers a forced refetch using the last successful load options (or current snapshot values).
4. Invalid load options (`sceneId` or `manifestUrl` missing/empty) produce a `provider_runtime` issue with code `invalid_load_options`.
5. Fetch failures produce a `provider_runtime` issue with code `manifest_fetch_failed`.

`bd-3ato` validation bridge details:
1. Provider enforces scene-manifest consistency checks aligned to `contracts/validation/run-validation.mjs`:
- duplicate `poi_id`
- missing/duplicate `highlight_nodes`
- duplicate nav-anchor IDs per POI
- object `poi_id` references and interaction routing requirements
- nav-grid walkable length/value sanity for array encoding
- duplicate `decor_anchors.*.anchor_id`
- collider positivity checks (`box.size`, `capsule.radius`, `capsule.height`)
- schema-required `version >= 1`
2. Contract-aligned validation failures map to `manifest_validation` issues with stable codes (for example `poi_id_duplicate`, `navigation_walkable_length_mismatch`, `manifest_version_invalid`).
3. Parse-level failures from loader are surfaced as `manifest_validation` with code `manifest_parse_failed`; transport fetch failures remain `provider_runtime` with code `manifest_fetch_failed`.

`bd-319z` derived-index cache details:
1. Derived indices are built once per successful provider load and stored on `snapshot.derived`.
2. Cached maps include:
- `poisById`
- `objectsById`
- `poiHighlightNodesById`
- `poiFocusConfigById`
- `navigationGrid` (collider blockers applied)
- `navAnchorIssues`
3. Getter methods (`getPoi`, `getObject`, `getHighlightNodes`, `getPoiFocusConfig`) read cached derived maps first, with manifest fallback.
4. Invalidation behavior:
- failed validation/load paths clear usable derived output (`derived: null`)
- successful reload recomputes full derived indices for the new manifest payload.

`bd-1fec` lifecycle-state details:
1. Provider now exposes explicit terminal states for overlay consumption:
- `loaded`: manifest + derived data available, no warnings
- `degraded`: manifest + derived data available, but non-fatal issues exist
- `error`: terminal failure, load not usable
2. Structured progress phases are emitted throughout load:
- `fetch_manifest` -> `validate_manifest` -> `derive_indices` -> `load_assets` -> `complete`
- failures move to `failed` with descriptive `label`
3. Non-fatal nav diagnostics are emitted as `warning` severity issues (`nav_validation`, `nav_anchor_issues_detected`) and drive `degraded` status.
4. Fatal manifest validation and fetch/parse failures remain `error` with severity `error`.

`bd-2mo` asset-load pipeline details:
1. Provider load flow now executes:
- fetch manifest
- contracts-aligned validation
- derived-index build
- runtime shell/object load through `loadSceneFromManifest(...)`
2. `snapshot.runtimeData` is populated on successful load and can be consumed by downstream scene runtime integration work.
3. Provider supports injected `assetManager` via `SceneRuntimeProviderProps` for deterministic tests/overrides; defaults to shared singleton.
4. Asset load outcomes:
- fatal load failure -> `error` state + `asset_loading` issue (`asset_load_failed`)
- partial object-load issues from `runtimeData.issues` -> `degraded` state + warning issue (`asset_object_load_warnings`)

`bd-w2z` Scene Issues overlay + load-order policy details:
1. Scene runtime health is surfaced in overlay as a compact, always-available section (not debug-HUD only):
- lifecycle status + current progress phase/label
- policy progress summary using shell -> critical -> decor grouping
- top actionable provider issues with remediation hints
- explicit scene-runtime reload action
2. Loading order policy is now enforced before runtime asset load:
- shell first (already fixed)
- manifest objects grouped into `critical` then `decor`
- deterministic ordering within each group by `object.id`
- `critical` classification rules:
  - explicit `tags` contains `critical`
  - or object participates in interaction/collider routing (`interaction`, `poi_id`, collider enabled)
  - explicit `tags` contains `decor` forces `decor` bucket
3. Asset warning telemetry now includes policy diagnostics:
- load policy marker: `shell_critical_decor`
- critical/decor missing counts and ids in issue details
- warning message includes missing-by-bucket summary for faster triage
4. Console-noise reduction:
- nav anchor validation warnings are now console-emitted only when debug HUD is explicitly enabled.
- primary operator-facing diagnostics route through structured Scene Runtime overlay issue cards.

`bd-3kq` routing alignment note:
1. Navigation panel selection is now manifest-metadata-first:
- `poi.interaction.panel` is treated as primary routing source
- legacy command-name mappings remain as compatibility fallback only
2. This keeps command-to-panel behavior deterministic while reducing static command tables in nav flow.

`bd-qg4i` render policy note:
1. Object-level render hints are now supported through `objects[].render_policy`:
- `cast_shadow` (boolean, optional)
- `receive_shadow` (boolean, optional)
- `cull_distance_m` (number > 0, optional)
2. Defaults remain conservative when fields are absent:
- `cast_shadow=true`
- `receive_shadow=true`
- no distance culling
3. Parsed policy is preserved in `SceneObjectSpec` and applied by the OfficeScene runtime path to loaded objects (shadow flags + optional camera-distance visibility culling).
4. Authoring semantics are documented in `docs/manifest-render-policy.md`.

`bd-2iss` instance-group batching note:
1. `SceneRuntimeProvider` now computes `derived.instancedAssembly` after runtime assets load.
2. The batching result is assembled from runtime-loaded objects + manifest object specs (not ad-hoc scene-local recomputation).
3. `derived.instancingStats` summarizes measurable batching telemetry (`estimatedDrawCallSavings` and counts) for downstream perf reporting (`bd-50t4`, `bd-lfez`).
4. `OfficeScene` consumes provider-derived batching output and only renders fallback objects from `fallbackObjectIds`.
5. This keeps instancing decisions deterministic per runtime load and exposes one canonical batching surface for downstream metrics/QA work.

Error/warning telemetry is standardized through `SceneRuntimeIssue` with:
1. severity (`error|warning`)
2. source (`manifest_validation|asset_loading|nav_validation|provider_runtime`)
3. stable issue code and message

## Scope Guardrails

The provider is intentionally a scene-runtime contract, not a global app store:
1. no UI panel state ownership
2. no transport/session ownership
3. no command-dispatch ownership

Those remain in their existing domains (`uiStore`, network gateway layer, world socket/offline runtime).
