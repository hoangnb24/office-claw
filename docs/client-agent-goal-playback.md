# Client Agent Goal Playback (`bd-7jc`)

## Scope
- Consume `agent_goal` envelopes from websocket stream.
- Interpolate agent traversal along `payload.path` at `payload.speed_mps`.
- Treat each new goal as an override of any prior in-flight path.
- Drive animation clip selection from movement/work intent.

## Runtime Wiring
- `apps/client-web/src/network/useWorldSocket.ts`
  - Parses `snapshot` and `agent_goal` envelopes.
  - Normalizes snapshot agent shape (`id` or `agent_id`) and state strings into client `AgentState`.
  - Parses and validates goal payload (`agent_id`, `goal.kind`, `path`, `speed_mps`, `arrival_radius`).
- `apps/client-web/src/state/worldStore.ts`
  - Adds `agentGoals` map keyed by `agent_id`.
  - Adds `upsertAgentGoal(agentId, goal)` for last-write-wins intent updates.
- `apps/client-web/src/scene/OfficeScene.tsx`
  - Joins each rendered agent with `agentGoals[agent.id]`.
- `apps/client-web/src/scene/agents/AgentRenderer.tsx`
  - Performs per-frame path traversal with distance budget = `speed_mps * delta`.
  - Uses arrival radius checks per waypoint and eases back to latest snapshot correction when no active traversal.
  - Applies animation state resolution:
    - moving => `walking`
    - `deliver_artifact` => `working`
    - `seek_decision` => `meeting`
    - `wait` => `idle`
    - `go_to_*` completion + stale `walking` snapshot => `idle`

## Edge Behavior
- Invalid goal payloads are ignored without mutating store state.
- Empty/invalid paths do not start traversal.
- Large snapshot drift snaps immediately; normal drift eases smoothly.
- New goal replaces previous traversal immediately (override semantics).

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
