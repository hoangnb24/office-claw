# Server-World Office Decor Placement (`bd-1cd`)

Last updated: 2026-02-14

## Scope

Implemented deterministic office-decor unlock and placement behavior in world-state:
- unlock mapping from project completion outcomes
- anchor-aware placement using scene `decor_anchors` IDs
- authoritative inclusion in `snapshot.payload.office_decor`

Code:
- `apps/server-world/src/worldState.mjs`
- `apps/server-world/src/nav/manifestNav.mjs`
- tests:
  - `apps/server-world/test/simulation.test.mjs`
  - `apps/server-world/test/nav.test.mjs`

## Outcome-to-Decor Mapping

When a project transitions to `completed`, world-state derives a decor unlock outcome:
- `artifact_approved`: project has at least one approved artifact
- `decision_resolved`: no approved artifacts, but has resolved decisions
- `completed`: fallback for terminal completion without the above

Each outcome maps to a deterministic decor prefix and preferred anchor group (`trophy_shelf`).

## Anchor-Aware Placement Rules

1. Scene manifest loader parses `decor_anchors` and exposes normalized anchor metadata.
2. World-state chooses anchors by ID (not world position), preferring the configured anchor group.
3. Placement avoids occupied anchors when possible; if all are occupied, deterministic reuse is applied.
4. Unlock is idempotent per project (`unlocked_by_project_id` / `project_id`) to prevent duplicate decor rows.

## Snapshot Contract

`buildSnapshot()` continues to emit:
- `office_decor[]` sorted by `decor_id`

Rows include:
- `decor_id`
- `project_id`
- `anchor_id`
- `unlocked_by_project_id`
- `outcome`

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
