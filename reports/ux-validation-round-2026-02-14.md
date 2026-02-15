# UX Validation Round Report (bd-243)

Date: 2026-02-14  
Bead: `bd-243`

## Scope

Executed scenario-based UX validation evidence for implemented flows and synthesized quantitative + qualitative findings into prioritized backlog deltas.

## Reproducible Evidence

Commands run:

```bash
tools/qa/run-visual-qa.sh --mode both --validate
npm --prefix contracts run validate
```

Artifacts used for deterministic flow timing:

- `contracts/fixtures/golden-flow-submit-kickoff.fixture.json`
- `contracts/fixtures/golden-flow-blocked-decision.fixture.json`
- `contracts/fixtures/golden-flow-artifact-approve.fixture.json`

Structured metric export:

- `reports/ux-validation-round-2026-02-14.json`

## Quantitative Scorecard (Fixture-Based)

### Scenario A: First request to first visible progress

- `request_accepted -> kickoff_started`: **1s**
- `request_accepted -> tasks_created`: **2s**
- Threshold target (TTFV median): `<=240s`
- Status: **Target**

Note: same-flow `task_started` is not present in the submit/kickoff fixture, so `tasks_created` is used as first-visible-progress proxy for this scripted validation pass.

### Scenario B: Blocked task resolution

- `decision_requested -> decision_resolved`: **3s**
- `decision_requested -> task_started (resumed)`: **4s**
- Threshold target (unblock median): `<=120s`
- Status: **Target**

### Scenario C: Deliverable review confidence

- `artifact_delivered -> review_approved`: **3s**
- `review_approved -> task_done`: **1s**
- Stable approval ratio in canonical flow: **1.00 (100%)**
- Threshold target ratio: `>=0.85`
- Status: **Target**

## Qualitative Findings

1. `F-01` (Medium): QA launcher is deterministic, but scenario execution still depends on manual operator walkthrough quality.  
Impact: run-to-run rigor can drift without strict report capture.  
Recommendation: enforce pass/fail + notes for `VQA-01..VQA-06` on every weekly run.

2. `F-02` (Medium): client build emitted large chunk warning (~1.1MB minified JS).  
Impact: first-load latency risk can weaken first-run confidence metrics.  
Recommendation: schedule chunk splitting/perf follow-up before M8 demo readiness.

3. `F-03` (Low): perceived-control and approval-confidence Likert metrics are not derivable from fixtures alone.  
Impact: trust metrics remain incomplete until moderated sessions run.  
Recommendation: execute cohort protocol from `docs/ux-outcome-metrics-and-research-protocol.md` and store anonymized scores in report JSON.

## Prioritized Backlog Deltas

1. Prioritize blocker-loop closure continuity on `bd-787` (currently in progress): direct path to `bd-291` milestone gate.
2. Keep `bd-2ng` (override controls UX) as next high-value control/trust item once current client reservations clear.
3. Create a new performance bead for client bundle chunk splitting to mitigate first-run latency risk surfaced in this validation pass.

## Acceptance Criteria Trace

- Scripted validation sessions executed with reproducible commands: **Yes**
- Quantitative and qualitative findings captured with impact framing: **Yes**
- Prioritized backlog deltas linked to bead-level next work: **Yes**
