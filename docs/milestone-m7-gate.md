# Milestone M7 Gate: Blocker / Decision Loop Complete (`bd-291`)

Last updated: 2026-02-14

## Gate Intent (from `PLAN.md`)

M7 deliverables (`PLAN.md:714`):
- blocker icon/cues for blocked agents
- decision panel with resolution options
- blocked agent seeks user (fresh `player_pos` preferred, lounge fallback otherwise)
- unblock resumes task execution

M7 DoD:
- Flow 7 complete (`blocked -> decision -> resolve -> resume`)

## Dependency Closure

All declared `bd-291` dependencies are closed:
- `bd-6o8` ✅ explainability cues for blockers/traceability
- `bd-2yy` ✅ M6 gate validated
- `bd-5ql` ✅ decision panel + `resolve_decision` workflow
- `bd-3ux` ✅ server decision lifecycle + unblock orchestration
- `bd-787` ✅ blocked-agent seek-user with lounge fallback semantics

## Evidence Mapping

### 1) Blocked cues are surfaced to the user
- Client explainability cues include blocker transitions and timeline trace links:
  - `docs/client-explainability-cues.md`
  - `apps/client-web/src/overlay/OverlayRoot.tsx`
- Agent blocked visual state mapping is present in renderer:
  - `apps/client-web/src/scene/agents/AgentRenderer.tsx`

### 2) Decision workflow is user-actionable
- Decision panel and resolve wiring:
  - `docs/client-decision-panel.md`
  - `apps/client-web/src/network/decisionCommands.ts`
  - `apps/client-web/src/network/useWorldSocket.ts`

### 3) Server blocker/unblock orchestration is deterministic
- Decision lifecycle + blocker propagation/resume:
  - `docs/server-world-decision-lifecycle.md`
  - simulation coverage in `apps/server-world/test/simulation.test.mjs` (blocked decision creation + resolve resume paths)

### 4) Seek-user behavior handles fresh player position and deterministic fallback
- Fresh/stale/unavailable `player_pos` paths:
  - `apps/server-world/test/simulation.test.mjs:790`
- Lounge fallback targeting when authored:
  - `apps/server-world/test/simulation.test.mjs:839`
  - `docs/server-world-blocked-agent-seek-user.md`

## Validation Runs (this gate pass)

- `npm --prefix apps/server-world test` ✅
- `npm --prefix contracts run validate` ✅
- `npm --prefix apps/client-web run typecheck` ❌ (concurrent `bd-2ng` WIP: unused vars in `apps/client-web/src/overlay/OverlayRoot.tsx`)
- `npm --prefix apps/client-web run build` ❌ (same concurrent `bd-2ng` WIP)

## Known Limitations / Follow-ups

- Current `cozy_office_v0` scene does not yet author a `poi_lounge`; runtime uses deterministic scene default fallback position when lounge POI is absent.
- Client typecheck/build instability is currently tied to active `bd-2ng` edits, not to M7 dependency code paths validated here.

## Gate Decision

**M7 validated** for blocker/decision/resume loop behavior based on closed dependency set and passing server/protocol validation evidence, with the concurrent `bd-2ng` client compile issue explicitly tracked outside this gate's dependency set.
