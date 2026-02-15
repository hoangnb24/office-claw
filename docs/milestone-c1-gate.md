# Milestone C1 Gate Validation

Related bead: `bd-gtq`  
Date: `2026-02-14`

## Gate intent (Core Client-Only Playable)

- M0-M2 capabilities verified in offline mode.
- Real GLB assets wired through scene manifest.
- Deterministic mock-driven demo path available before server complexity.

## Dependency Closure

- `bd-1xq` (GLB preflight validator): closed
- `bd-2ii` (offline vertical-slice validation): closed
- `bd-2gd` (offline mock world mode): closed
- `bd-bg2` (scene manifest bound to GLBs): closed
- `bd-2d8` (v0 GLB asset pack + naming contract): closed
- `bd-3mh` (M2 movement + walk-to-interact gate): closed

## Exit Criteria Check

1. Client runs core loop offline with reproducible behavior.
   - Offline runtime profile and deterministic seeded world implemented in:
     - `apps/client-web/src/config/runtimeProfile.ts`
     - `apps/client-web/src/offline/mockWorldRuntime.ts`
     - `apps/client-web/src/network/useWorldSocket.ts`
   - Offline validation evidence documented in:
     - `docs/client-offline-vertical-slice-validation.md`

2. POI interactions + movement + walk-to-interact functional with real GLB assets.
   - Asset and manifest readiness:
     - `assets/scenes/cozy_office_v0.scene.json`
     - `docs/scene-manifest-offline-notes.md`
     - `reports/glb-preflight-report.md`
   - Interaction/movement gate evidence:
     - `docs/milestone-m1-gate.md`
     - `docs/milestone-m2-gate.md`
     - `docs/player-click-to-move.md`

3. Validation findings sufficient to begin M3 integration.
   - Core offline loop validated and documented with re-run checklist:
     - `docs/client-offline-vertical-slice-validation.md`
   - Remaining risks are known, scoped, and tracked:
     - `bd-2cx` (visual/manual QA scripts)
     - `bd-94r` (accessibility hardening)
     - `bd-e7n`, `bd-zax` (camera/usability polish)
     - `bd-2k5` (performance instrumentation/bundle pressure follow-up)

## Validation Commands

```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build
```

Result:
- Both commands pass.
- Build emits non-blocking bundle-size warning.

## Gate Decision

`C1` is **validated** for client-only first playable entry conditions.  
M3/server integration may proceed with tracked follow-up risks above.
