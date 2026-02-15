# UX Outcome Metrics and Research Protocol (bd-3cx)

Last updated: 2026-02-14

## 1) Scope and intent

This document defines:
- user outcome metrics for OfficeClaw v0
- milestone pass/fail thresholds
- scenario-based UX validation scripts
- participant profiles and run protocol
- telemetry mapping to current protocol events, plus explicit gaps

The goal is to make milestone decisions deterministic and comparable across runs.

## 2) Metric definitions

### 2.1 Time-to-first-value (TTFV)
- Definition: elapsed time from accepted request to first meaningful system output.
- Start signal: `event.request_accepted`.
- End signal (first observed): `event.task_started` or `event.artifact_delivered`.
- Reporting: median and p90 per scenario cohort.
- Why it matters: validates that the system creates visible momentum quickly.

### 2.2 Unblock time
- Definition: elapsed time from blocker raised to blocker resolved and work resumed.
- Start signal: `event.decision_requested` or `event.task_blocked`.
- End signal: `event.decision_resolved` followed by `event.task_started` for the blocked task.
- Reporting: median, p90, and unresolved-blocker rate.
- Why it matters: measures friction during user-assisted orchestration.

### 2.3 Approval confidence
- Definition: confidence that approved deliverables are truly “done.”
- Quantitative proxy:
  - `review_approved` events not followed by `review_changes_requested` within 24h.
  - Formula: `stable_approvals / total_approvals`.
- Qualitative supplement:
  - post-scenario confidence rating (1-5 Likert): “I was confident approving this deliverable.”
- Reporting: stable-approval ratio + average Likert score.
- Why it matters: approval should feel trustworthy, not guessy.

### 2.4 Perceived control
- Definition: whether users feel they can direct and correct the system.
- Primary measure: post-scenario Likert (1-5): “I felt in control of what the system did next.”
- Behavioral proxy:
  - successful use of available controls (assign, approve/revise, resolve decision).
  - number of aborted flows (panel opened but action abandoned).
- Reporting: average Likert, task completion rate, abandonment rate.
- Why it matters: trust requires both visibility and agency.

## 3) Success and failure thresholds

Use thresholds below for milestone review.

| Metric | Target (Pass) | Warning | Fail |
|---|---|---|---|
| TTFV (median) | <= 4:00 | 4:01-8:00 | > 8:00 |
| TTFV (p90) | <= 7:00 | 7:01-12:00 | > 12:00 |
| Unblock time (median) | <= 2:00 | 2:01-5:00 | > 5:00 |
| Unresolved blockers | <= 5% | 6-15% | > 15% |
| Stable approval ratio | >= 85% | 70-84% | < 70% |
| Approval confidence (Likert) | >= 4.2 | 3.6-4.1 | < 3.6 |
| Perceived control (Likert) | >= 4.2 | 3.6-4.1 | < 3.6 |
| Flow abandonment rate | <= 10% | 11-20% | > 20% |

Milestone decision rule:
- Pass: no Fail thresholds and at least 6/8 metrics at Target.
- Conditional pass: no Fail thresholds and at least 6/8 at Warning-or-better, with remediation plan.
- Fail: any metric in Fail band for two consecutive runs.

## 4) Scenario scripts (for UX validation rounds)

Run all scenarios in order, same build and seed where possible.

### Scenario A: First request to first visible progress
- Objective: validate first-use clarity and perceived momentum.
- Steps:
  1. Enter office and locate Inbox.
  2. Submit request: “Create a landing page plan + copy + design brief.”
  3. Observe kickoff, task creation, and first task start.
  4. Explain in own words what is happening and why.
- Key captures:
  - TTFV start/end timestamps
  - confusion points (moderator notes)
  - perceived control Likert

### Scenario B: Blocked task resolution
- Objective: validate unblock loop and recovery clarity.
- Steps:
  1. Trigger or wait for a `decision_requested` state.
  2. Resolve the decision through the intended UI.
  3. Confirm task resumes.
  4. Describe confidence in the chosen resolution.
- Key captures:
  - unblock time
  - unresolved blocker rate
  - confidence and clarity ratings

### Scenario C: Deliverable review and approval decision
- Objective: validate artifact review quality and approval confidence.
- Steps:
  1. Open Delivery Shelf and inspect artifact.
  2. Decide approve vs request changes.
  3. If requesting changes, provide explicit revision instructions.
  4. Re-open updated artifact and make final decision.
- Key captures:
  - stable approval ratio
  - approval confidence Likert
  - abandonment points in review flow

## 5) Participant profiles and sampling

Minimum cohort per round: 9 participants (3 per profile).

### Profile P1: Technical builder
- Background: engineer/technical PM, familiar with AI tools.
- Risk to probe: speed expectations and tolerance for ambiguity.

### Profile P2: Product/operations lead
- Background: workflow owner, medium technical literacy.
- Risk to probe: decision-loop clarity and management confidence.

### Profile P3: Non-technical operator/founder
- Background: outcome-focused, low tolerance for hidden logic.
- Risk to probe: perceived control and trust in approvals.

Sampling rules:
- Balance by prior exposure to similar tools.
- Exclude team members who authored the tested flow.
- Record demographics only if needed for analysis, and anonymize in output.

## 6) Telemetry mapping to current capabilities

### Directly supported by existing protocol events
- TTFV: `request_accepted`, `task_started`, `artifact_delivered`
- Unblock time: `decision_requested`, `decision_resolved`, `task_started`
- Stable approvals: `review_approved`, `review_changes_requested`
- Flow progress context: `tasks_created`, `task_blocked`, `task_done`

### Gaps and coverage plan
- Gap: panel-abandonment and control-attempt telemetry is not explicitly defined in `PROTOCOL.md`.
- Gap owner tasks:
  - `bd-2k5` for instrumentation baseline
  - `bd-243` for scenario execution + synthesis
- Interim approach:
  - collect moderator timing + action logs manually during rounds
  - normalize into the same metric formulas so trend lines remain comparable

## 7) Execution and reporting protocol

- Run cadence: weekly during active milestone development.
- Artifacts per round:
  - raw timing/event export
  - scorecard against thresholds
  - top 5 user friction findings
  - fix recommendations linked to bead IDs
- Decision output:
  - `Pass`, `Conditional pass`, or `Fail`
  - explicit remediation owners and target date
