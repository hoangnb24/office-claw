# Client SceneLoader

Related bead: `bd-1zb`

## Delivered module
- `apps/client-web/src/scene/loader/SceneLoader.ts`
- `apps/client-web/src/scene/loader/index.ts`

## Responsibilities
- Parse and validate scene manifest payloads.
- Fetch manifest from URL (`fetchSceneManifest`).
- Load/clone office shell and object GLBs through `AssetManager`.
- Apply transform placement (pos/rot/scale).
- Produce interaction-ready metadata registries:
  - `poisById`
  - `objectsById`
  - `interactiveObjectIds`
  - `colliderObjectIds`
  - nav grid, spawns, decor anchors

## Failure and edge behavior
- Invalid manifest shape throws explicit parsing errors with field paths.
- Unknown `poi_id` reference on an object fails validation.
- Office shell clone failure throws (critical path).
- Object clone failures are collected in `issues[]` while continuing with other objects.

## Integration contract
Call:
```ts
const runtime = await loadSceneFromManifest("assets/scenes/cozy_office_v0.scene.json", assetManager);
```

Use resulting runtime data to:
- mount shell/object `Object3D` instances into scene graph
- seed interaction layer registries
- seed nav/spawn state and decor anchors

## Validation run
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
