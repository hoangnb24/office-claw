# Client Agent Inspector Panel

`bd-2ej` implements an interactive Agent Inspector panel in the overlay.

## Delivered behavior

- clicking an agent opens the Agent Inspector panel (existing interaction intent wiring now backed by panel content)
- panel renders live details for the focused agent:
  - agent id and inferred role label
  - current simulation state
  - world position
  - active task id/status (if available from snapshot)
  - blocker summary (including latest decision id when present in related events)
  - computed needs hints (assignment, kickoff, unblock/decision, sync outcome)
- panel quick actions:
  - focus agent
  - open Task Board
  - open Event Feed
  - open Inbox (decision/chat entry path)

## Notes

- role is inferred from agent id naming conventions (e.g. `agent_bd` => Business Director).
- blocker decision context is inferred from the latest related event carrying `decision_id`.
- this panel is client-only and depends on live snapshot/event updates from the world socket.

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
