# AssetManager Contract (bd-1aj)

`apps/client-web/src/scene/assets/AssetManager.ts` provides URL-keyed GLB loading and clone-safe runtime usage.

## Behaviors

- URL-keyed cache:
  - `load(url)` reuses an in-flight or completed GLTF promise per URL.
  - cache hit emits telemetry (`cache_hit`).

- Safe clone semantics:
  - `clone(url)` uses `SkeletonUtils.clone` to safely duplicate skinned mesh hierarchies.
  - animation clips are cloned per request so clips can be modified per instance.

- Telemetry hooks:
  - configurable callback via `AssetManagerOptions.onTelemetryEvent`.
  - emits `load_start`, `load_progress`, `load_success`, `load_error`, and `cache_hit`.

## Failure semantics

- failed load removes the URL from cache so retry attempts are possible.
- caller receives the underlying loader error from `load`/`clone`.

## Integration note

A singleton is exposed from `apps/client-web/src/scene/assets/assetManagerSingleton.ts` and currently initialized in `OfficeScene` as a smoke probe until real scene-manifest URLs are wired.
