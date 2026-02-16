# Instanced Mesh Assembly

Related beads: `bd-3cof`, `bd-2iss`

## Purpose

Build an instanced render path for safe candidate groups while preserving a full fallback path for correctness.

## Runtime Modules

- `apps/client-web/src/scene/render/instancedAssembly.ts`
- `apps/client-web/src/scene/runtime/SceneRuntimeProvider.ts`
- `apps/client-web/src/scene/OfficeScene.tsx`

## Assembly Flow

1. `SceneRuntimeProvider` loads manifest/runtime objects and computes `derived.instancedAssembly`.
2. The assembly module starts from `detectInstancingCandidates(...)` output (`bd-2sv8`).
3. Each candidate group is accepted only if strict constraints pass.
4. `OfficeScene` consumes provider-derived groups and renders accepted groups as `InstancedMesh`.
5. All non-accepted objects stay on legacy per-object primitives.
6. Provider also emits `instancingStats` (including `estimatedDrawCallSavings`) for perf reporting.

## Hard Constraints (Instanced Path)

For every object in a candidate group:

1. loaded object exists
2. no `cull_distance_m` policy (currently unsupported in instanced path)
3. exactly one mesh node in the loaded hierarchy
4. mesh is single-material (no material arrays)
5. geometry reference matches group baseline
6. material reference matches group baseline

If any check fails for a group, the group is rejected and those objects remain in fallback.

## Fallback Safety Contract

Fallback path remains the baseline behavior:

1. render each loaded object as `<primitive object={loaded.root} />`
2. keep existing interaction wiring via `interactionTargetFromObjectSpec(...)`
3. keep POI highlight marker behavior unchanged
4. keep per-object shadow/cull policy handling on fallback objects

This prevents visual/interaction regressions while rolling out instancing.

## Exclusion Telemetry

The assembly returns two exclusion sets:

1. candidate exclusions from metadata screening (`bd-2sv8` detector)
2. assembly exclusions from runtime mesh/material checks

Both use stable reason codes for reproducible diagnostics.
