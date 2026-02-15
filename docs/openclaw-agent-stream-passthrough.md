# OpenClaw Agent Stream Passthrough (`bd-32c`)

## Scope

- optional websocket delivery of `agent_stream` deltas to subscribed clients
- strict per-session channel gating (`channels.agent_stream`)
- monotonic per-`stream_id` sequence enforcement
- done-sentinel handling to close streams deterministically

## Server implementation

File:
- `apps/server-world/src/worldServer.mjs`

Added behavior:
- subscribe validation now accepts `channels.agent_stream` boolean.
- server exposes `publishAgentStream(payload)` API:
  - validates required payload fields
  - enforces `seq` monotonic increase per `stream_id`
  - rejects updates for completed streams (`done=true` already observed)
  - broadcasts only to sessions with `channels.agent_stream === true`
- observability now tracks `pipeline.agent_stream_published`.

## Protocol/schema updates

- `PROTOCOL.md`
  - subscribe channel list now includes optional `agent_stream`.
  - server behavior notes include conditional `agent_stream` delivery.
- `contracts/schemas/protocol-envelope.schema.json`
  - `subscribe_payload.channels.agent_stream` added as optional boolean.

## Test coverage

File:
- `apps/server-world/test/worldServer.test.mjs`

Added test:
- `testAgentStreamPassthroughChannelGating`
  - stream-enabled subscriber receives `agent_stream` deltas
  - stream-disabled subscriber receives none
  - done sentinel is forwarded and stream is marked complete
  - post-done publish for same `stream_id` is rejected with `CONFLICT`

## Validation

- `npm --prefix apps/server-world test`
- `npm --prefix contracts run validate`
