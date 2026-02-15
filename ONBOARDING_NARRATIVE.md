# ONBOARDING_NARRATIVE.md

Last updated: 2026-02-14
Linked bead: `bd-qwe`

## 1) Objective

Define a first-run onboarding narrative that gets a new user from zero context to one successful request lifecycle with clear control signals.

Primary outcomes:
- user can navigate core POIs without confusion
- user submits one request and sees visible progress
- user understands how to unblock and review work

## 2) First-run narrative arc

### Phase A: Orientation (0-90s)
- Introduce office purpose, core POIs, and the BD role.
- Keep camera and UI guidance minimal but explicit.
- Goal: user can identify Inbox, Task Board, and Delivery Shelf.

### Phase B: First action (90-210s)
- Guide user to Inbox (`poi_reception_inbox`) and submit a starter prompt.
- Confirm submission with immediate event-feed echo and state change language.
- Goal: user feels “my action changed the world.”

### Phase C: Visible momentum (210-360s)
- Surface kickoff/task creation and first `task_started` event.
- Highlight where work is happening (desk/agent focus).
- Goal: user sees progress without searching.

### Phase D: Control confirmation (360-600s)
- Walk through one decision or review action (resolve decision or approve/revise artifact).
- Emphasize “you can redirect outcomes.”
- Goal: user ends onboarding with agency, not just observation.

## 3) Step map by POI and UI flow

| Step | Trigger | POI / Surface | User action | System response | Exit criteria |
|---|---|---|---|---|---|
| 1 | First login | Overlay intro + Event Feed | Continue | Show mini map of core POIs | User can identify next target |
| 2 | Intro complete | `poi_reception_inbox` | Walk + open Inbox | Focus mode + anchored panel | Inbox panel open |
| 3 | Inbox open | `InboxPanel` | Submit starter request | `request_submitted` -> `request_accepted` | Confirmation visible in feed |
| 4 | Request accepted | `poi_meeting_table` + feed | Observe kickoff | `kickoff_started` + `tasks_created` | At least one task appears |
| 5 | Tasks created | `poi_task_board` | Open board, inspect assignees | Task statuses visible and explained | User can identify active task |
| 6 | First task starts | Agent/desk POI | Inspect agent state | `task_started` + contextual explanation | User understands current work |
| 7 | First decision/review moment | `poi_lounge` or `poi_delivery_shelf` | Resolve decision or review artifact | `decision_resolved` or review event | One control loop completed |
| 8 | Completion | Summary overlay | Confirm understanding | Next-step suggestions | Onboarding marked complete |

## 4) Milestones and success heuristics

These heuristics align with `docs/ux-outcome-metrics-and-research-protocol.md` (`bd-3cx`).

### Milestone O1: Orientation complete
- Target: >= 90% of users open Inbox without moderator help.
- Warning: 75-89%.
- Fail: < 75%.

### Milestone O2: First request completed
- Target: >= 85% submit request end-to-end in one attempt.
- Warning: 70-84%.
- Fail: < 70%.

### Milestone O3: Time-to-first-value
- Target: median <= 4:00 from `request_accepted` to first visible progress (`task_started` or `artifact_delivered`).
- Warning: 4:01-8:00.
- Fail: > 8:00.

### Milestone O4: Perceived control
- Target: average >= 4.2/5 for “I felt in control of what happened next.”
- Warning: 3.6-4.1.
- Fail: < 3.6.

### Milestone O5: Completion
- Target: >= 80% of first-run users complete all onboarding steps in <= 10 minutes.
- Warning: 60-79%.
- Fail: < 60%.

## 5) Copy and interaction tone guidance

Voice principles:
- direct and short (1-2 sentences per state)
- action-oriented (“Do X to get Y now”)
- transparent uncertainty (“Waiting on decision” over vague “processing”)
- no hidden jargon (avoid “FSM,” “orchestration,” “pipeline” in user copy)

Copy patterns:
- Confirmation: “Request received. Team kickoff is starting now.”
- Progress: “Research started at the desk near the window.”
- Blocker: “A decision is needed to continue. Choose one option to unblock.”
- Recovery: “Couldn’t apply that change yet. Try again or open details.”

Interaction patterns:
- always pair POI focus with one clear primary action
- avoid multi-CTA overload during onboarding
- keep tooltips contextual and procedural (“Click to review deliverables”)

## 6) Implementation handoff notes

### Client
- Add onboarding state machine with explicit step IDs (`intro`, `inbox_submit`, `task_board`, `control_loop`, `done`).
- Gate step advancement on observable events, not timeouts alone.
- Persist onboarding completion flag per user/session.

### Server/Protocol integration
- Ensure onboarding surfaces consume canonical events already defined in `PROTOCOL.md`.
- Keep command/ack correlation visible for request submission and decision/review actions.

### Content
- Reuse error/recovery language from `CONTENT_GUIDELINES.md`.
- Keep first-run text strings centralized for fast iteration.

### QA
- Validate each step exit criteria with deterministic scripted runs.
- Record where users stall and which POI/action caused confusion.
- Track milestone outcomes against O1-O5 thresholds per build.

## 7) Out-of-scope for this planning artifact

- Final UI component implementation details
- animation/sound polish decisions
- localization and internationalization strategy
