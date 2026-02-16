# Manifest Render Policy

Related bead: `bd-qg4i`

## Purpose

Allow content authors to tune object-level rendering cost/quality through scene manifest metadata, without code changes.

## Field

`objects[].render_policy` (optional object)

Supported keys:

1. `cast_shadow` (`boolean`)
2. `receive_shadow` (`boolean`)
3. `cull_distance_m` (`number`, must be `> 0`)

## Defaults

If `render_policy` is omitted, runtime uses conservative defaults:

1. `cast_shadow = true`
2. `receive_shadow = true`
3. `cull_distance_m = none` (no distance-based culling)

## Runtime Behavior

For each object in `OfficeScene`:

1. shadow flags are applied recursively to mesh nodes in the loaded object root
2. if `cull_distance_m` is set, object visibility toggles based on camera distance:
   - visible when `distance <= cull_distance_m`
   - hidden when farther

Fallback meshes (for object-load failure paths) also apply `cast_shadow` and `receive_shadow`.

## Example

```json
{
  "id": "delivery_cone_marker",
  "url": "/assets/blocker_cone.glb",
  "transform": {
    "pos": [-0.45, 0, 1.35],
    "rot": [0, 0.4, 0],
    "scale": [1, 1, 1]
  },
  "tags": ["prop", "storytelling", "delivery"],
  "collider": {
    "type": "box",
    "size": [0.35, 0.5, 0.35],
    "offset": [0, 0.25, 0]
  },
  "render_policy": {
    "cast_shadow": false,
    "receive_shadow": false,
    "cull_distance_m": 10
  }
}
```

## Validation

Schema contract is enforced in:

- `contracts/schemas/scene-manifest.schema.json`

Loader parse validation is enforced in:

- `apps/client-web/src/scene/loader/SceneLoader.ts`
