# Client Decision Panel

`bd-5ql` adds a dedicated Decision panel and `resolve_decision` client workflow.

## Delivered

- New overlay panel: `Decisions`
  - open-decision list
  - focused decision card (id/status/project/task/prompt/choice)
  - quick choice helpers + explicit resolve action
- Event-feed linkage:
  - clicking an event with `decision_id` opens/focuses the Decision panel
- Command wiring:
  - `dispatchResolveDecision(decisionId, choice)` sends `resolve_decision`
  - ack/error microcopy and panel notices
  - success path opens Task Board to surface unblock follow-through
- Decision state hydration:
  - snapshot `payload.decisions[]` parsed into UI decision state
  - decision event upserts for `decision_requested` / `decision_resolved`

## Files

- `apps/client-web/src/network/decisionCommands.ts`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
