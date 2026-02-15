# Client BD Chat Panel (`bd-12m`)

## Scope

Implemented a dedicated **BD Chat** panel in the client overlay for protocol `chat` envelopes.

Files:
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Behavior

- New panel: `bd-chat` (shortcut `Alt+3`).
- Renders only chat messages that satisfy both:
  - `thread_id === "bd_main"`
  - one participant is BD (`agent_bd`, `bd`, or `*_bd`)
- Non-BD chat traffic is ignored and never surfaced in UI state.
- Suggested actions are rendered as buttons per chat message.

## Suggested Action Handling

- `open_task_board`:
  - opens Task Board and focuses `poi_task_board`.
- `auto_assign`:
  - dispatches `auto_assign` for the first available project in current task snapshot.
  - reports deterministic success/error notice if no project or socket is unavailable.
- `clarify`:
  - opens Inbox and focuses `poi_reception_inbox`.
- Unknown actions:
  - routed to Inbox with a safe notice (no hidden behavior).

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```
