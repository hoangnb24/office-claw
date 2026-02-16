# Instancing Candidate Detection

Related bead: `bd-2sv8`

## Purpose

Identify object groups that are safe to batch with `InstancedMesh` using manifest metadata, while explicitly excluding risky objects.

## Runtime Entry Point

- `apps/client-web/src/scene/render/instancingCandidates.ts`
- `detectInstancingCandidates(objectSpecs)`

## Grouping Rules

Objects are considered compatible only when all of the following match:

1. `instance_group` (trimmed, non-empty)
2. `url`
3. normalized render policy:
   - `cast_shadow` (`true` default)
   - `receive_shadow` (`true` default)
   - `cull_distance_m` (`null` when omitted)

The detector computes a stable `compatibilityKey` from those fields and buckets objects by that key.

## Safety Exclusions

Objects are excluded before grouping when they carry per-object semantics that are unsafe to merge:

1. missing `instance_group`
2. `interaction` present
3. `poi_id` present
4. `highlight_nodes` present
5. collider present (`collider !== false` and defined)

After bucketing, any bucket with only one object is excluded with reason `single_member_bucket`.

## Determinism Contract

1. Input objects are sorted by `id` before processing.
2. Each bucket's `objectIds` are sorted lexicographically.
3. Output groups are sorted by `(instanceGroup, compatibilityKey)`.
4. Output exclusions are sorted by `(objectId, reason)`.

Given the same manifest object set, output order is reproducible.

## Output Shape

`detectInstancingCandidates` returns:

- `groups`: compatible multi-object buckets (`length >= 2`)
- `exclusions`: explicit object-level exclusions with stable reason codes

This allows downstream assembly work (`bd-3cof`) to batch only safe candidates and surface why others were skipped.
