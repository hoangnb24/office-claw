# Final Known-Issues Register (`bd-37hw`)

Generated at: `2026-02-15T14:03:10Z`  
Agent: `PurpleOtter`

## Scope

Consolidated known-issues state for late-phase polish freeze review, derived from latest QA/perf/UX evidence.

Primary inputs:

1. `reports/offline-visual-qa-sweep.bd-t9jf.md`
2. `reports/visual-qa-online.bd-3uwh.md`
3. `reports/visual-qa-both-modes.bd-3vgq.md`
4. `reports/user-facing-success-checklist.bd-v0c9.md`
5. `reports/performance-optimization-before-after.bd-lfez.md`
6. `reports/offline-session-trace-export.bd-1cx3.md`

## Blocker Issues

| ID | Severity | Summary | Evidence | Status |
| --- | --- | --- | --- | --- |
| `KI-B01` | high | Offline event-feed interactions do not drive expected POI/agent focus transitions (`VQA-02`, `VQA-04`). | `reports/offline-visual-qa-sweep.bd-t9jf.md`, `reports/visual-qa-both-modes.bd-3vgq.md` | open |
| `KI-B02` | high | Offline highlight lifecycle cannot be validated because focus transitions fail (`VQA-03`). | `reports/offline-visual-qa-sweep.bd-t9jf.md`, `reports/visual-qa-both-modes.bd-3vgq.md` | open |

## Non-Blocker / Residual Issues

| ID | Severity | Summary | Evidence | Status |
| --- | --- | --- | --- | --- |
| `KI-R01` | medium/high | Offline performance under sweep remains poor (`fps ~1.3`, `frame p95 ~1231.5ms`, hotspots ~99%). | `reports/offline-visual-qa-sweep.bd-t9jf.md`, `reports/performance-optimization-before-after.bd-lfez.md` | open (risk) |
| `KI-R02` | low | Console warning noise (React Router future flags, WebGL ReadPixels stall warnings in automated path). | `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/console.log` | accepted-risk candidate |
| `KI-R03` | low | Build emits large-chunk warning; not a direct polish-flow blocker but relevant for future optimization budget. | recent `npm --prefix apps/client-web run build` outputs | accepted-risk candidate |

## Resolved / Healthy Signals

1. Online VQA sweep (`bd-3uwh`) passed `VQA-01..VQA-06`.
2. Deterministic offline trace artifact exported and round-trip validated (`bd-1cx3`).
3. Phase-8 optimization direction shows strong draw-call reduction, with explicit caveats around absolute frame-time.

## Recommended Tracking Linkage

Carry blocker IDs (`KI-B01`, `KI-B02`) and residual risks (`KI-R01..03`) into:

1. `reports/freeze-recommendation.bd-37hw.md`
2. final gate decision bead `bd-2hik`
