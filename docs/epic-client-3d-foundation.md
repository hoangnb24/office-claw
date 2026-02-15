# Epic Closeout: Client 3D Foundation and Scene Runtime

Related bead: `bd-1mw`  
Date: `2026-02-14`

## Epic intent recap

Build the client-side 3D foundation required for reliable rendering, scene interaction, camera control, authoritative update reconciliation, and runtime diagnostics.

## Dependency closure

All `bd-1mw` dependencies are closed:

- `bd-1b8` collider plumbing + nav-grid debug visualization
- `bd-1zb` scene loader from manifest
- `bd-1aj` GLB asset manager (cache/clone)
- `bd-375` orthographic isometric camera rig
- `bd-1ht` client-web bootstrap (React + r3f + Zustand boundaries)
- `bd-361` reconnect state machine + stale-state UX
- `bd-3r0` snapshot reconciliation
- `bd-7jc` agent goal/path playback interpolation
- `bd-y9e` AgentRenderer clip mapping + fallback behavior
- `bd-1eo` debug HUD/runtime metrics

## User-visible outcomes (end-to-end)

Validated progression artifacts:
- `docs/milestone-m0-gate.md`
- `docs/milestone-m1-gate.md`
- `docs/milestone-m2-gate.md`
- `docs/client-offline-vertical-slice-validation.md`

Concrete outcomes now present:
- Scene boots with orthographic camera and manifest-driven assets.
- POI/agent interaction targeting, focus, and highlight coupling are working.
- Click-to-move + walk-to-interact pathing works with collider-aware blocking.
- Agent movement playback and snapshot correction are visible and stable.
- Reconnect/stale-state UX keeps the client usable through socket interruptions.

## Operational considerations

Key runtime/ops artifacts:
- `docs/client-reconnect-state-machine.md`
- `docs/client-snapshot-reconciliation.md`
- `docs/runtime-performance-instrumentation.md`
- `docs/client-debug-hud.md`
- `docs/visual-qa-checklist.md`
- `tools/qa/run-visual-qa.sh`

This provides:
- explicit reconnect/resume behavior
- correction visibility for authoritative snap-back
- perf telemetry and debug toggles
- repeatable visual QA scenario scripts for online/offline paths

## Validation run (this pass)

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build
tools/qa/run-visual-qa.sh --mode both
```

Result:
- all commands passed
- build emits non-blocking large-chunk warning (`>500kB`) in production output

## Known limitations / follow-ups

- bundle size pressure remains and is tracked under polish/perf follow-up work (`bd-zax`, plus related perf tasks)
- broader accessibility/onboarding trust polish is tracked in user-trust epic tasks (`bd-94r`, `bd-57w`, `bd-6o8`)

## Epic decision

`bd-1mw` is **validated and complete**.  
The client 3D foundation/runtime baseline is sufficiently mature to support higher-level interaction, trust, and milestone gate work on top of it.
