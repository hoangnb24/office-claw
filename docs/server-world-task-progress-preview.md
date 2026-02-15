# Server Task Progress Preview

`task_progress` events are optional UI feedback events emitted from `agent_stream` updates.

## Safety Constraints

- Never expose raw stream deltas in `preview_text`.
- Never emit chain-of-thought style content.
- Emit deterministic short labels keyed by stream `kind` (`token`, `thought`, `code`).

## Rate Limiting

- Progress previews are throttled per `task_id`.
- Maximum emission rate is `2` events per second (`500ms` minimum interval).
- `done=true` stream updates still emit a final progress preview.

## Event Shape

Each emitted preview event includes:

- `name: "task_progress"`
- `project_id`
- `task_id`
- `agent_id`
- `kind`
- `percent` (`1..99`)
- `preview_text` (safe deterministic label)
- `meta.source = "agent_stream"` with source stream metadata

## Validation Coverage

`apps/server-world/test/worldServer.test.mjs` includes coverage for:

- safe preview text generation (no raw stream leakage)
- per-task rate limiting enforcement
- continued passthrough of `agent_stream` envelopes
- finalization preview emission on completed streams
