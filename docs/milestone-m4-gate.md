# Milestone M4 Gate Validation

Related bead: `bd-325`  
Date: `2026-02-14`

## Gate intent (PLAN.md M4)
- event feed UI is present and usable as the semantic timeline
- clicking events highlights linked POIs and agents
- optional camera focus support is wired through existing focus flows
- optional `task_progress` previews are non-blocking for M4

## Dependency closure
- `bd-3ka` (M3 gate): closed
- `bd-17x` (Event Feed panel + click-to-highlight/jump): closed

Supporting transitive dependencies already closed:
- `bd-3sk` (HighlightManager for POIs/participants)
- `bd-57r` (semantic event timeline broadcaster with monotonic sequencing)

## Criteria check
1. All milestone dependencies are completed and aligned to M4 gate intent.
   - Verified through `br show` dependency closure for `bd-325` and `bd-17x`.
2. End-to-end demo path works without manual state patching.
   - Event feed ingestion/render and click-to-focus linkage: `docs/client-event-feed.md`.
   - POI/participant highlight semantics and deterministic clear/reapply behavior: `docs/client-highlight-manager.md`.
   - Event timeline ordering/replay baseline in server runtime: `docs/server-world-event-replay.md`, `docs/server-world-ws-lifecycle.md`.
   - Deterministic operator QA script covering hitboxes, focus, highlights, and event linkage: `docs/visual-qa-checklist.md`.
3. Known limitations are explicitly tracked.
   - Optional safe `task_progress` preview path remains tracked under `bd-39l`.
   - Accessibility hardening and explainability polish continue in follow-up beads (`bd-94r`, `bd-6o8`, `bd-17v`).

## Validation signals
- `npm --prefix apps/client-web run build` ✅
- `npm --prefix apps/client-web run typecheck` currently fails in active `bd-3no` WIP scope:
  - `apps/client-web/src/network/useWorldSocket.ts:223`
  - `apps/client-web/src/network/useWorldSocket.ts:233`
  - This is concurrent overlap outside `bd-325` doc-only scope; M4 dependency closure and behavior evidence remain intact.

## Gate decision
`M4` is **validated**: the event feed serves as the truth timeline and is coupled to world highlighting/focus behaviors required for this milestone.  
`M5` task-loop UX delivery can proceed on this baseline.
