# bd-8vmp Offline Desk Sit/Work Behavior

Generated: 2026-02-16T01:49:59Z

## Objective

Implement deterministic offline behavior where the primary BD agent navigates to the dev desk anchor and settles into working state.

## Implementation

Updated `apps/client-web/src/offline/mockWorldRuntime.ts`:

1. Added deterministic desk route for `agent_bd`:
   - `[0.95, 0, -1.05]`
   - `[0.62, 0, -0.82]`
   - `[0.34, 0, -0.58]`
   - `[0.125, 0, -0.375]` (matches `poi_dev_desk_1/sit_work` anchor)
2. Added state transition logic:
   - En route: `walking`
   - At final waypoint: `working`
3. Added conditional `agent_bd` goal injection during approach ticks:
   - `kind: go_to_poi`
   - speed/arrival tuned for smooth travel (`speedMps: 0.95`, `arrivalRadius: 0.15`)
4. Added one-shot event when desk anchor is reached:
   - `meta.behavior = "agent_bd_reached_desk_anchor"`

## Deterministic timeline

- Tick 0: `agent_bd` starts far from desk, `walking`, goal path to desk.
- Tick 1-2: continues movement along route.
- Tick 3+: reaches desk anchor and remains `working` at desk context.

## Validation

1. `npm --prefix apps/client-web run typecheck` passed.
2. `npm --prefix apps/client-web run build` passed.
3. `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight.bd-38md.md` passed (anchor reachability clean).

## Notes

- `AgentRenderer` already maps `working` state to `Work_Typing` (with alias fallback to seated clips), so desk arrival now transitions into sit/work animation behavior in offline mode.
