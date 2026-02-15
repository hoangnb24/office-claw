# Blocked-Agent Seek-User Cues with Lounge Fallback (`bd-787`)

Last updated: 2026-02-14

## Scope

Implemented and validated blocked-agent seek-user behavior with deterministic lounge fallback targeting:
- approach player when fresh `player_pos` is available
- otherwise rendezvous at lounge POI anchor when present
- deterministic scene fallback when lounge POI is not authored

Updated files:
- `apps/server-world/src/nav/manifestNav.mjs`
- `apps/server-world/src/worldState.mjs`
- `apps/server-world/test/nav.test.mjs`
- `apps/server-world/test/simulation.test.mjs`

## Server Behavior

1. Scene manifest loader now surfaces POI nav anchors (`poiAnchors`) in addition to nav grid and decor anchors.
2. World-state resolves blocked-agent fallback target in this order:
   - fresh `player_pos` cache -> approach player
   - `poi_lounge` nav anchor -> rendezvous at lounge
   - deterministic scene default -> stable fallback position
3. Player-position debug context (`getPlayerPositionContext`) now exposes:
   - `fallback_pos`
   - `fallback_source`
   - `fallback_poi_id`

## Client Cue Coverage

Blocked indicator presentation is already wired in the client:
- `apps/client-web/src/scene/agents/AgentRenderer.tsx`
  - blocked state maps to explicit "Think"/blocked animation path.
- `apps/client-web/src/overlay/OverlayRoot.tsx`
  - blocked task/decision context is surfaced in agent/task inspector panels.

No client overlay edits were made in this pass to avoid overlap with active `bd-12m` scope.

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
