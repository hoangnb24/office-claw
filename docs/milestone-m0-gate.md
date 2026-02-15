# Milestone M0 Gate Validation

Related bead: `bd-jva`  
Date: `2026-02-14`

## Gate intent (PLAN.md M0)
- isometric/orthographic camera baseline
- shell + props load path in place
- baseline lighting
- resize-safe rendering

## Dependency closure
- `bd-1zb` SceneLoader: closed
- `bd-1aj` AssetManager: closed
- `bd-375` Isometric camera rig: closed
- `bd-1ht` client bootstrap: closed

## Criteria check
1. All milestone dependencies are completed and validated.
   - Verified via `br show` status checks for all `bd-jva` dependencies.
2. End-to-end demo path works without manual state patching.
   - `WorkspaceRoute` mounts `Canvas` + `OfficeScene` + overlay stack and runs under normal app startup.
   - Scene/interaction/nav layers initialize from committed manifest/runtime modules without one-off local patch scripts.
3. Known limitations are documented.
   - Placeholder/partial art maturity and offline notes documented in:
     - `docs/scene-manifest-offline-notes.md`
   - Build-time chunk-size warning remains (non-blocking for M0 foundation scope).

## Verification commands
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`

Both pass in current workspace.
