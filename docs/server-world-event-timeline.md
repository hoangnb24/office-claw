# Server-World Event Timeline (bd-57r)

`apps/server-world/src/eventTimeline.mjs` introduces an append-only semantic event stream with monotonic sequencing.

## What Was Added

- Append-only event timeline service:
  - `append(payload)` returns persisted event with monotonic `seq`
  - `readSince(seq)` returns replay-friendly ordered slices
  - bounded in-memory retention (configurable max events)
- World server integration:
  - successful command handling emits semantic `event` messages
  - per-session ordered delivery for subscribers with `channels.events = true`
  - server-side timeline accessors:
    - `getEventTimeline({ sinceSeq })`
    - `getEventTimelineStats()`

## Semantic Event Mapping

Current command-to-event mapping includes:

- `submit_request` -> `kickoff_started`
- `assign_task` -> `task_assigned`
- `auto_assign` -> `tasks_created`
- `resolve_decision` -> `decision_resolved`
- `approve_artifact` -> `review_approved` (+ `task_done` when task is linked)
- `request_changes` -> `review_changes_requested`
- `split_into_tasks` -> `tasks_created`
- `start_kickoff` -> `kickoff_started`

Each emitted event payload carries:

- `seq` (monotonic timeline sequence)
- `project_id`
- optional linked IDs (`task_id`, `artifact_id`, `decision_id`, `agent_id`)
- `meta.in_reply_to` and `meta.command_name` for traceability/debug

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
