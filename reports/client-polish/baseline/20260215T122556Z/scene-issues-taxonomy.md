# Baseline Scene Issues and Defect Taxonomy (`bd-3jj`)

Run ID: `20260215T122556Z`  
Captured: `2026-02-15`  
Primary evidence: `reports/client-polish/baseline/20260215T122556Z/scene-issues-preflight.md`

## Severity Rubric

- `High`: blocking quality gate; must be fixed before final polish acceptance.
- `Medium`: non-blocking but user-visible risk; should be scheduled in active polish phases.
- `Low`: structural/drift risk; acceptable short-term with explicit tracking.

## Taxonomy Table

| Issue ID | Category | Severity | Blocker | Repro Context | Likely Subsystem | Evidence |
|---|---|---|---|---|---|---|
| `SI-001` | Asset animation contract violation | High | Yes | Run `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/client-polish/baseline/20260215T122556Z/scene-issues-preflight.md` and inspect `required_clips` errors for `assets/glb/agent1_skeleton.glb`. | Asset pipeline / GLB clip normalization (`tools/glb-normalize-clips.mjs`, source GLB exports) | `scene-issues-preflight.md` (`Errors: 4`, missing `Idle`, `Walk`, `Work_Typing`, `Think`) |
| `SI-002` | Asset scale normalization warning | Medium | No | Same preflight run; inspect `scale` warnings for `agent1_animations.glb`, `agent1_skeleton.glb`, `desk.glb`, `shelf.glb` (`Armature` at `~0.01`). | Asset export conventions / DCC-to-GLB transform pipeline | `scene-issues-preflight.md` (`Warnings: 4`) |
| `SI-003` | Navigation anchor reachability inconsistency | Medium | No | In runtime, interact with `poi_delivery_shelf`; known baseline note reports delivery shelf anchor on blocked cell. | Scene manifest/nav integration (`assets/scenes/cozy_office_v0.scene.json`, nav grid + collider merge in client nav layer) | `CLIENT_POLISH_PLAN.md` line noting blocked-cell anchor inconsistency |
| `SI-004` | Manifest source-of-truth drift | Medium | No | Compare active runtime references under `assets/scenes/**` vs `apps/client-web/src/scene/highlight/cozy_office_v0.scene.json`; duplicate manifest paths can diverge. | Manifest/runtime loading architecture | `CLIENT_POLISH_PLAN.md` current problem summary (manifest duplication/drift) |
| `SI-005` | Offline command/panel parity gap | Medium | No | Run offline mode (`VITE_OFFLINE_MOCK_WORLD=1`) and trigger panel actions that dispatch commands; baseline notes indicate UI dispatch can fail without socket client. | Client network dispatch abstraction (`apps/client-web/src/network/*`, offline runtime bridging) | `CLIENT_POLISH_PLAN.md` current problem summary (offline parity incomplete) |

## Blockers vs Tolerable Warnings

### Blocking

- `SI-001` is the only current blocking issue because required agent animation clips are contract-critical for polished runtime behavior.

### Tolerable (temporarily)

- `SI-002` through `SI-005` are non-blocking for immediate baseline capture, but must remain tracked during active polish phases.

## Suggested Follow-Up Mapping

- `SI-001`, `SI-002` -> Phase 2 asset production + validation tasks.
- `SI-003` -> Phase 5 interaction/navigation reliability tasks.
- `SI-004` -> Phase 3 runtime asset/manifest path unification tasks.
- `SI-005` -> Phase 6 offline behavior parity tasks.
