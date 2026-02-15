# Server-World Agent FSM and Ceremony Overrides

Linked bead: `bd-1ce`

## State model

`apps/server-world/src/worldState.mjs` now maintains a deterministic agent state machine with canonical state values:

- `IdleAtHome`
- `WalkingToPOI`
- `WorkingAtPOI`
- `InMeeting`
- `BlockedWaiting`
- `SeekingUserDecision`

A transition guard table enforces allowed base-state transitions. Invalid attempted transitions are blocked and counted as `invariant_violations` in FSM debug state.

## Override stack semantics

Per-agent runtime now tracks:

- `base_state`
- `override_stack[]` (top-of-stack wins)
- transition counters and invariant counters

Ceremony overrides are stack-based and tick-decayed:

- `start_kickoff` pushes a `kickoff` override (`InMeeting`) for project participants.
- review commands (`request_changes` / `approve_artifact`) push a `review` override (`InMeeting`) for relevant project participants.
- overrides expire deterministically after fixed tick windows and state returns to base behavior.

## Transition and invariant behavior

- Assignment flows transition agents into `WalkingToPOI` then `WorkingAtPOI` on simulation ticks.
- `request_changes` sets linked task to `blocked` and assignee base state to `SeekingUserDecision`.
- `resolve_decision` unblocks affected project tasks and transitions eligible agents back to task-driven states.
- Terminal/unassigned task paths return agent base state to `IdleAtHome`.

## Debug visibility for tests/tooling

World-state store now exposes:

- `getAgentFsm(agent_id)`
- `getAllAgentFsm()`

These return base/effective state, override stack, transition count, and invariant counters.

## Validation

- `npm --prefix apps/server-world test`
- `npm --prefix contracts run validate`

Simulation coverage was added in `apps/server-world/test/simulation.test.mjs` for:

- deterministic state transitions (`Idle/Walking/Working`)
- kickoff override stack behavior
- review override behavior
- blocked/seek-user transitions and resolution behavior
