# Protocol Contract Test Coverage (bd-2fp)

This document defines the current coverage contract for protocol validation under `contracts/validation/run-validation.mjs`.

## Coverage Areas

- Envelope schema validation for all message families (`hello`, `hello_ack`, `subscribe`, `event`, `snapshot`, `agent_goal`, `agent_stream`, `chat`, `command`, `ack`, `error`, `ping`, `pong`).
- Required-field negative coverage via `contracts/fixtures/required-fields.fixture.json`.
- Invalid payload class mapping via `contracts/fixtures/invalid-payloads.fixture.json`.
- Command/response correlation invariants:
  - `in_reply_to` must reference an in-scope command id.
  - every command must receive exactly one terminal response (`ack` or `error`).
  - duplicate terminal responses are invalid.
  - validated through both positive (`command-taxonomy.fixture.json`) and negative (`invalid-ack-error-correlation.fixture.json`) fixtures.
- Golden flow sequence checks and snapshot postconditions:
  - submit -> kickoff -> tasks created
  - assign -> task_assigned -> task_started -> task_progress
  - artifact delivered -> review approved -> task done
  - blocked task -> decision requested/resolved -> task resumed
  - reconnect/resume handshake -> subscribe snapshot -> monotonic replay events

## Validation Commands

```bash
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```
