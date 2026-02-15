# Client Task Board Panel

Related bead: `bd-2wy`

## Delivered
- Task Board panel now renders:
  - `To Do` / `Doing` / `Done` status columns from snapshot task state.
  - agent assignment drop columns for drag-to-agent reassignment.
- Auto-assign action wired to `auto_assign` command using current snapshot project id.
- Response handling:
  - success/error notices shown in Task Board panel.
  - assign-task optimistic update/rollback behavior reuses `bd-ysv` state machine.

## Files
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/network/taskBoardCommands.ts`
- `apps/client-web/src/state/worldStore.ts`
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/styles.css`

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
