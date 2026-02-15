# Server World WebSocket Lifecycle (`bd-2re`)

Last updated: 2026-02-14

## Scope

Implemented a baseline world transport service at `/ws/world` with protocol-aligned lifecycle handling:
- connection bootstrap
- `hello -> hello_ack`
- `subscribe -> initial snapshot`
- protocol error responses for invalid handshake/subscribe flows
- lifecycle metadata logging

Code location:
- `apps/server-world/src/worldServer.mjs`
- `apps/server-world/src/index.mjs`
- tests: `apps/server-world/test/worldServer.test.mjs`

## Session lifecycle model

Session metadata tracked per connection:
- `session_id`
- `connected_ts`, `disconnected_ts`
- `remote_address`
- `hello_received`, `subscribed`
- selected `scene_id` and channel flags

Lifecycle events logged:
- `connected`
- `socket_error` (if raised)
- `disconnected` (with close code + reason)

## Handshake and subscribe behavior

1. Client connects to `/ws/world`.
2. Client must send `hello` first.
3. Server validates `payload.client.{name,build,platform}` and returns `hello_ack`.
4. Client sends `subscribe` with `scene_id` and channel flags.
5. Server stores subscription and emits initial `snapshot`.

If `subscribe` arrives before `hello`:
- server responds with protocol envelope `type="error"` and `code="VALIDATION_FAILED"`.

If `hello` payload is malformed:
- server responds with `type="error"` and `code="VALIDATION_FAILED"`.

## Initial snapshot contract

Initial snapshot currently emits empty world arrays for bootstrap safety:
- `agents`
- `projects`
- `tasks`
- `artifacts`
- `decisions`
- `office_decor`

This keeps protocol shape stable while simulation/state store (`bd-22h`) is implemented.

## Validation

Run:

```bash
npm --prefix apps/server-world install
npm --prefix apps/server-world test
```

Covered tests:
- valid hello + subscribe path emits `hello_ack` and initial `snapshot`
- invalid subscribe-before-hello returns protocol-compliant `error`
- malformed hello returns protocol-compliant `error`
- lifecycle log captures connect/disconnect entries
