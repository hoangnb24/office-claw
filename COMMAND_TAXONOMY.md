# COMMAND_TAXONOMY.md

Last updated: 2026-02-14  
Linked bead: `bd-3sz`

## 1) Scope

This document defines the canonical command catalog, normalized ack/error behavior, and deterministic error handling policy for OfficeClaw client/server interactions.

## 2) Command catalog (payload + response contracts)

All command messages use the protocol envelope with:
- `type: "command"`
- `id`: canonical message id
- `payload.name`: one of the allowed commands
- `payload.data`: command-specific payload schema

| Command | Required `payload.data` fields | Success response | Common failure codes |
|---|---|---|---|
| `submit_request` | `text` | `ack(status="ok")` | `VALIDATION_FAILED`, `RATE_LIMITED`, `INTERNAL` |
| `assign_task` | `task_id`, `agent_id` | `ack` | `NOT_FOUND`, `CONFLICT`, `NOT_ALLOWED` |
| `auto_assign` | `project_id` | `ack` | `NOT_FOUND`, `CONFLICT` |
| `resolve_decision` | `decision_id`, `choice` | `ack` | `NOT_FOUND`, `CONFLICT` |
| `approve_artifact` | `artifact_id` | `ack` | `NOT_FOUND`, `CONFLICT` |
| `request_changes` | `artifact_id`, `instructions` | `ack` | `NOT_FOUND`, `CONFLICT`, `VALIDATION_FAILED` |
| `split_into_tasks` | `artifact_id`, `task_titles[]` | `ack` | `NOT_FOUND`, `CONFLICT`, `VALIDATION_FAILED` |
| `player_pos` | `pos[3]` | `ack` (optional in v0) | `VALIDATION_FAILED` |
| `move_player_to` | `pos[3]` | `ack` (optional in v0) | `VALIDATION_FAILED`, `NOT_ALLOWED` |
| `start_kickoff` | none required (`project_id` optional) | `ack` | `NOT_ALLOWED`, `CONFLICT` |

Canonical payload schemas:
- `contracts/schemas/commands.schema.json`
- `contracts/schemas/protocol-envelope.schema.json`

Typed contracts:
- `contracts/types/commands.ts`

## 3) Ack/error normalization

### Ack contract
- Envelope `type = "ack"`.
- Required payload fields:
  - `in_reply_to` (must match originating command `id`)
  - `status = "ok"`

### Error contract
- Envelope `type = "error"`.
- Required payload fields:
  - `in_reply_to` (must match originating command `id`)
  - `code` in `{VALIDATION_FAILED, NOT_FOUND, CONFLICT, RATE_LIMITED, NOT_ALLOWED, INTERNAL}`
  - `message` user-safe summary

## 4) Deterministic failure policy

| Error code | Deterministic server condition | UI state |
|---|---|---|
| `VALIDATION_FAILED` | Unknown command name or malformed payload shape | Prompt user to fix input |
| `NOT_FOUND` | Referenced entity absent in authoritative state | Refresh local state and reselect |
| `CONFLICT` | Illegal transition or stale action against newer state | Refresh + offer alternate action |
| `RATE_LIMITED` | Command throttled | Cooldown + retry |
| `NOT_ALLOWED` | Policy/permission denies command | Explain precondition or restriction |
| `INTERNAL` | Unhandled server failure | Retry once then fallback |

## 5) Unknown and malformed behavior

- Unknown command names MUST fail validation as `VALIDATION_FAILED`.
- Known command names with malformed `payload.data` MUST fail validation as `VALIDATION_FAILED`.
- Neither case may silently coerce to another command.

These behaviors are validated by:
- `contracts/fixtures/invalid-payloads.fixture.json`
- `contracts/validation/run-validation.mjs`

## 6) Correlation guarantees

- Every command must receive exactly one terminal response (`ack` or `error`) per request id.
- `in_reply_to` must reference a command id that exists in the same correlation scope.
- Duplicate terminal responses for the same command id are invalid.

Correlation checks are validated by:
- `contracts/fixtures/command-taxonomy.fixture.json`
- `contracts/validation/run-validation.mjs`
