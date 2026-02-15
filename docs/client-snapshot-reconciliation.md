# Client Snapshot Reconciliation

Related bead: `bd-3r0`

## What is implemented
- `apps/client-web/src/scene/agents/AgentRenderer.tsx`
  - Snapshot divergence is reconciled when an agent is not currently traversing a goal path.
  - Two correction modes are applied:
    - **Easing correction** for smaller deltas (`lerp` with `SNAP_EASE_PER_SECOND`).
    - **Hard teleport guardrail** for large deltas (`SNAP_TELEPORT_THRESHOLD`).
  - Correction debug visibility is surfaced as throttled world events (`snapshot_correction`) so behavior is visible in the Event Feed stream.

## Reconciliation rules
- If `distance_to_snapshot > SNAP_TELEPORT_THRESHOLD`, jump directly to snapshot target.
- Else if `distance_to_snapshot > MIN_SEGMENT_DISTANCE`, ease toward snapshot target.
- While active goal traversal is running, goal path playback remains authoritative for the render step.

## Debug visibility
- Correction events are emitted with metadata:
  - mode (`ease` or `hard_teleport`)
  - correction distance in meters
  - threshold/easing parameters
- Emission is throttled to avoid event spam while still exposing correction behavior.

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
