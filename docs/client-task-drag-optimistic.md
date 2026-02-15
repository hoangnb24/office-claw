# Client Task Drag Optimistic Assignment

Related bead: `bd-ysv`

## Delivered
- Task board drag ghost state in UI store (`taskDragGhost`).
- Snapshot task ingestion into world store for task board rendering.
- Optimistic assignment state machine:
  - on drop, `assign_task` command is sent and local assignee is updated immediately.
  - pending optimistic assignment tracked by `commandId`.
  - on `ack`, optimistic assignment is confirmed.
  - on `error`, previous assignee is restored deterministically.
- Task board panel rendering includes draggable task cards and agent drop targets.

## Files
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/state/worldStore.ts`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
