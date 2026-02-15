# server-world

Minimal world transport service implementing `/ws/world` session lifecycle behavior for OfficeClaw protocol bootstrap.

## Implemented behavior

- WebSocket endpoint: `/ws/world`
- `hello` validation -> `hello_ack` response with `session_id`
- `subscribe` validation (requires prior `hello`) -> initial `snapshot`
- `ping` -> `pong` echo (`nonce` preserved)
- `command` dispatch table with deterministic terminal `ack` or `error` (`in_reply_to` correlation)
- simulation loop with bounded configurable tick rate (10-20Hz)
- authoritative world snapshot store with deterministic `seq`/`clock_ms`
- low-rate authoritative snapshot publisher (2-5Hz) with correction metadata
- append-only semantic event timeline broadcaster with monotonic `seq`
- cursor-based replay APIs with optional durable event-log persistence
- deterministic request/task lifecycle orchestration for assignment/start/progress/done flow
- deterministic agent FSM with ceremony override stack semantics (kickoff/review)
- scene-manifest nav grid loading and server-side A* movement routing with occupancy checks
- decision lifecycle runtime hooks with blocker propagation and targeted unblock resume behavior
- reconnect/resync resume handling with bounded replay + snapshot fallback
- protocol-compliant `error` envelopes for invalid flow/payloads
- session lifecycle logs with connect/disconnect reasons and session identifiers

## Scripts

```bash
npm install
npm run typecheck
npm test
npm run dev
```
