# Client Inbox Submit Request Flow

Related bead: `bd-3ax`

## Delivered
- Inbox panel request form in `OverlayRoot`.
- `submit_request` command dispatch helper with local transport/validation feedback.
- Ack/error handling wired in `useWorldSocket`:
  - success notice in inbox panel
  - error microcopy mapped from protocol error codes
- Post-submit visual feedback integration:
  - on `submit_request` ack, focus moves to `poi_task_board`
  - task-board panel opens automatically
  - server semantic events flow into Event Feed (`bd-17x`) for timeline visibility

## Files
- `apps/client-web/src/network/inboxCommands.ts`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
