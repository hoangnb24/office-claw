# CONTENT_GUIDELINES.md

Last updated: 2026-02-14
Related bead: `bd-3h0`

## Purpose
Define copy and interaction-language rules for loading, empty, error, and explainability states across OfficeClaw UI surfaces. This document is implementation-ready and maps directly to downstream UI beads.

## Core Voice Rules
- Keep copy short and concrete: one sentence for state, one sentence for next action.
- Avoid internal system terms unless they are already visible in UI labels.
- Prefer action verbs and explicit outcomes: "Retry sync" over "Try again."
- Never expose hidden model reasoning; only show user-safe progress summaries.
- Match world semantics from protocol and POIs: request, task, decision, artifact.

## State Pattern Templates

### Loading
- Pattern:
  - Primary: `"<object> is loading."`
  - Secondary: `"You can keep exploring the office while this finishes."`
  - Action: `Cancel` only when cancellation is safe; otherwise no destructive action.
- Example:
  - `"Task board is loading."`
  - `"Assignments will appear in a moment."`

### Empty
- Pattern:
  - Primary: `"No <objects> yet."`
  - Secondary: `"Create or trigger <object> from <entrypoint>."`
  - Action: one clear CTA.
- Example:
  - `"No open decisions right now."`
  - `"Submit a request at Reception to start new work."`

### Error
- Pattern:
  - Primary: `"Couldn't <action>."`
  - Secondary: `"Reason: <safe reason>."`
  - Action row: one primary recovery action, one secondary fallback.
- Example:
  - `"Couldn't assign that task."`
  - `"Reason: the assignee is already in a meeting."`
  - Actions: `Choose another agent`, `Refresh board`.

### Explainability
- Pattern:
  - Primary: `"<agent/task> is doing <visible step>."`
  - Secondary: `"Next: <next step>."` or `"Blocked by: <decision needed>."`
- Example:
  - `"Research agent is comparing three competitor sites."`
  - `"Next: draft a summary for review."`

## Surface Mapping

### InboxPanel (`poi_reception_inbox`)
- Loading:
  - `"Inbox is loading."`
  - `"Recent requests and their kickoff status will appear here."`
- Empty:
  - `"No requests yet."`
  - `"Submit your first request to start the office workflow."`
  - CTA: `Submit request`
- Error:
  - `"Couldn't load inbox requests."`
  - `"Reason: connection to world server failed."`
  - Actions: `Retry`, `Open event feed`

### TaskBoardPanel (`poi_task_board`)
- Loading:
  - `"Task board is loading."`
  - `"Current assignments and progress are syncing."`
- Empty:
  - `"No tasks yet."`
  - `"Requests create tasks automatically after kickoff."`
  - CTA: `Go to inbox`
- Error:
  - `"Couldn't update task board."`
  - `"Reason: assignment command was rejected."`
  - Actions: `Retry assignment`, `Refresh board`

### AgentInspectorPanel (agent click)
- Loading:
  - `"Agent details are loading."`
  - `"State, current task, and blockers will appear here."`
- Empty:
  - `"No active task for this agent."`
  - `"Assign a task from the Task Board."`
  - CTA: `Open task board`
- Error:
  - `"Couldn't load agent state."`
  - `"Reason: latest snapshot is unavailable."`
  - Actions: `Retry`, `Wait for next snapshot`

### ArtifactViewerPanel (`poi_delivery_shelf`)
- Loading:
  - `"Deliverable is loading."`
  - `"Version details and review actions are on the way."`
- Empty:
  - `"No deliverables yet."`
  - `"Artifacts appear here when tasks reach delivery."`
  - CTA: `Check active tasks`
- Error:
  - `"Couldn't open this deliverable."`
  - `"Reason: artifact reference is missing."`
  - Actions: `Reload`, `Open event feed`

### DecisionPanel (`poi_lounge` or blocked agent click)
- Loading:
  - `"Decision prompt is loading."`
  - `"Required context and options will appear here."`
- Empty:
  - `"No open decisions."`
  - `"Blocked tasks will surface here when input is required."`
  - CTA: `View active tasks`
- Error:
  - `"Couldn't submit this decision."`
  - `"Reason: decision is no longer open."`
  - Actions: `Refresh decisions`, `Return to task board`

### ChatPanel (BD only)
- Loading:
  - `"BD is preparing a response."`
  - `"You can continue interacting with the office."`
- Empty:
  - `"No chat messages yet."`
  - `"Ask BD to summarize project status or blockers."`
  - CTA: `Ask for summary`
- Error:
  - `"Couldn't send your message."`
  - `"Reason: chat channel is unavailable."`
  - Actions: `Retry send`, `Use inbox/task board instead`

### EventFeedPanel
- Loading:
  - `"Event timeline is loading."`
  - `"Recent office activity will appear here."`
- Empty:
  - `"No events yet."`
  - `"Submit a request to generate kickoff and task events."`
  - CTA: `Go to inbox`
- Error:
  - `"Couldn't load event timeline."`
  - `"Reason: event stream disconnected."`
  - Actions: `Reconnect`, `Refresh page`

## Explainability Language Rules

### Allowed content
- Current visible phase (`Walking to meeting table`, `Working at dev desk`).
- User-facing progress percentages and step labels from `task_progress`.
- Explicit blocker reason and required user decision.

### Disallowed content
- Hidden chain-of-thought or private intermediate reasoning.
- Unbounded technical internals not actionable by the user.
- Ambiguous status claims without an observable next action.

### Explainability sentence formats
- State: `"<agent> is <current visible activity>."`
- Intent: `"Goal: <poi/action>."`
- Blocker: `"Blocked by <decision prompt>. Choose one option to continue."`
- Recovery: `"If this fails again, <fallback action>."`

## Error To Recovery Mapping

### Protocol-level command failures
- `VALIDATION_FAILED`
  - User copy: `"That action is missing required information."`
  - Recovery: highlight missing field, preserve unsent input.
- `NOT_FOUND`
  - User copy: `"That item no longer exists in the current session."`
  - Recovery: refresh panel snapshot and clear stale selection.
- `CONFLICT`
  - User copy: `"That action conflicts with the latest office state."`
  - Recovery: fetch latest snapshot; offer alternate action.
- `RATE_LIMITED`
  - User copy: `"Too many requests in a short time."`
  - Recovery: show cooldown timer and retry button.
- `NOT_ALLOWED`
  - User copy: `"This action is not allowed right now."`
  - Recovery: explain required precondition and deep-link to relevant panel.
- `INTERNAL`
  - User copy: `"Something went wrong on the server."`
  - Recovery: retry once, then route to fallback panel (Event Feed).

### Transport/state failures
- WebSocket disconnected
  - User copy: `"Connection lost. Reconnecting..."`
  - Recovery: automatic reconnect with manual `Retry now`.
- Snapshot stale
  - User copy: `"Live state is behind. Waiting for a fresh update."`
  - Recovery: block destructive actions until fresh snapshot arrives.
- Asset load failed
  - User copy: `"Some visuals failed to load."`
  - Recovery: render fallback marker, keep interaction path available.

## Implementation References (Downstream Beads)
- `bd-17v`: apply standardized loading/empty/error states in all primary panels using the templates above.
- `bd-6o8`: implement explainability cues using the allowed/disallowed rules and sentence formats above.
- `bd-361`: use transport/state failure mapping for reconnect + stale-state UX.
- `bd-hgb`: use asset failure mapping for loading progress and graceful fallback behavior.

## Validation Checklist
- Each primary panel has loading, empty, and error copy entries.
- Every protocol error code in `PROTOCOL.md` has user-safe copy and a concrete recovery action.
- Explainability text remains concise, non-technical, and action-oriented.
- Downstream implementing beads are explicitly referenced for adoption.
