# Client Event Feed Panel

Related bead: `bd-17x`

## Delivered
- Realtime event ingestion into client state from world socket `event` envelopes.
- Event feed rendering in `OverlayRoot` (`event-feed` panel).
- Click-to-highlight and optional jump/focus behavior:
  - clicking an event with `poi_id` sets focused POI (camera focus + highlight path).
  - clicking an event with `agent_id` (or first participant) sets focused agent and opens inspector.
  - linked panel open for known POI ids (`inbox`, `task-board`, `artifact-viewer`).

## Files
- `apps/client-web/src/state/worldStore.ts`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Notes
- Event feed is bounded to the latest 120 items in memory.
- Events are deduplicated by envelope `id` to avoid repeated rows on reconnect/replay.

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
