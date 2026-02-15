# Client Artifact Viewer Panel

`bd-3no` implements the Artifact Viewer panel with review actions and command feedback.

## Delivered

- Replaced Artifact Viewer placeholder with production panel UI:
  - artifact queue list with status/version/task context
  - focused artifact detail card
  - explicit review controls: `approve_artifact`, `request_changes`, `split_into_tasks`
- Added client artifact command helper:
  - `apps/client-web/src/network/artifactCommands.ts`
  - local validation and error microcopy for artifact review actions
- Snapshot + event wiring:
  - `payload.artifacts[]` now hydrates UI artifact state
  - artifact status updates react to event timeline (`artifact_delivered`, `review_approved`, `review_changes_requested`)
  - Event Feed click behavior now links artifact events to Artifact Viewer focus
- Command-result feedback:
  - ack/error notices for artifact actions
  - split/approve success paths link back to Task Board for follow-through visibility

## Files

- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/network/artifactCommands.ts`
- `apps/client-web/src/network/useWorldSocket.ts`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/styles.css`

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
