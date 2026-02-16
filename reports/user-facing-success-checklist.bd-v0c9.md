# User-Facing Polish Signoff Checklist (`bd-v0c9`)

Generated at: `2026-02-15T14:00:30Z`  
Agent: `PurpleOtter`

## Scope

Define and apply a user-facing acceptance checklist for polish gate decisions across discoverability, trust, and flow coherence.

Evidence sources:

1. `reports/visual-qa-online.bd-3uwh.md`
2. `reports/offline-visual-qa-sweep.bd-t9jf.md`
3. `reports/visual-qa-both-modes.bd-3vgq.md`
4. `docs/client-guided-onboarding-flow.md`

## Checklist and Results

| Category | Criterion | Result | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| Discoverability | Core UI entry points are obvious (`Inbox`, `Task Board`, `Artifact Viewer`). | pass | `VQA-01`, `VQA-05`, `VQA-06` artifacts in online/offline runs | keep |
| Discoverability | Task assignment options are clearly explained (manual drag + auto-assign). | pass | onboarding copy/hint documented in `docs/client-guided-onboarding-flow.md` | keep |
| Trust | Event-feed interactions drive expected focus transitions in both modes. | **fail** | Offline `OD-001` (`VQA-02`, `VQA-04`) from `reports/offline-visual-qa-sweep.bd-t9jf.md` | **risk: blocker candidate** |
| Trust | Highlight lifecycle behaves consistently after focus switches. | **fail** | Offline `VQA-03` failure; online pass (`reports/visual-qa-both-modes.bd-3vgq.md`) | **risk: blocker candidate** |
| Trust | Runtime experience remains stable enough for user confidence. | **fail** | Offline `OD-002` perf stress (`fps ~1.3`, `p95 ~1231.5ms`) | **risk: medium/high** |
| Flow coherence | End-to-end first-run path can complete without dead-end state transitions. | **partial** | Online sweep passes; offline focus-linked path is broken in mid-flow scenarios | **risk accepted only with explicit freeze waiver** |
| Flow coherence | Scenario evidence is traceable by `VQA-01..VQA-06` in both modes. | pass | `bd-3vgq` cross-mode matrix + screenshot sets | keep |

## Unmet Criteria and Risk Handling

Unmet criteria were not fixed in this bead; they are explicitly carried as signoff risks:

1. `R-UX-001` high: Offline event-focus linkage regression undermines trust and context predictability.
2. `R-UX-002` high: Offline highlight lifecycle cannot be validated due missing focus transitions.
3. `R-PERF-001` medium/high: Offline perf degradation may reduce perceived usability even when interactions are functionally available.

Recommended freeze policy:

1. Do not mark user-facing polish fully accepted while `R-UX-001`/`R-UX-002` remain open.
2. If freeze proceeds, require explicit waiver text in final gate packet with owner and follow-up bead links.

## Acceptance Mapping

1. Checklist includes discoverability, trust, and flow completion criteria: **met**.
2. Checklist is applied using QA evidence and attached to gate artifacts: **met**.
3. Unmet criteria are fixed or explicitly accepted as risk: **met** via explicit risk ledger above (not fixed in this bead).
