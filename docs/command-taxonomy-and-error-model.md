# Command Taxonomy and Error Model

This document defines the canonical command catalog, ack/error response contracts, and user-safe error mapping for OfficeClaw runtime commands.

## Source of Truth

- Command and response schemas: `contracts/schemas/commands.schema.json`
- Envelope binding: `contracts/schemas/protocol-envelope.schema.json`
- Type contracts and UI policy mapping: `contracts/types/commands.ts`
- Contract fixtures: `contracts/fixtures/command-taxonomy.fixture.json`

## Canonical Commands

- `submit_request`: submit user request text and optional constraints/attachments.
- `assign_task`: assign `task_id` to `agent_id`.
- `auto_assign`: trigger server-side assignment for `project_id`.
- `resolve_decision`: resolve blocking decision with `decision_id` and `choice`.
- `approve_artifact`: approve `artifact_id`.
- `request_changes`: request artifact revision using `artifact_id` and `instructions`.
- `split_into_tasks`: generate follow-up tasks from `artifact_id` and `task_titles[]`.
- `player_pos`: optional player position/facing signal for server behaviors.
- `move_player_to`: optional server-authoritative movement request.
- `start_kickoff`: optional dev/runtime kickoff trigger.
- `reassign_task`: move a `planned` or `blocked` task to another assignee.
- `cancel_task`: cancel a task with explicit `confirm=true` intent.
- `pause_project`: block new task dispatch for a project (`scope=dispatch_only`).
- `resume_project`: resume project dispatch after a pause.
- `rerun_task`: clone a `done` or `cancelled` task into a new `planned` task.

## Ack and Error Response Contracts

- `ack.payload`: `{ in_reply_to, status: "ok" }`
- `error.payload`: `{ in_reply_to, code, message }`
- `in_reply_to` must reference an existing command message id.
- Exactly one terminal response (`ack` or `error`) is expected per command.

## Error Code Taxonomy

- `VALIDATION_FAILED`: malformed/unknown command payload; user should fix input.
- `NOT_FOUND`: referenced entity missing/stale; user should refresh state.
- `CONFLICT`: lifecycle/state conflict; user should pick an alternative action.
- `RATE_LIMITED`: throttled; user should retry later.
- `NOT_ALLOWED`: disallowed by policy/permissions; user should stop or change scope.
- `INTERNAL`: server fault; user can retry or use fallback action.

## Validation Policy

- Envelope + payload validation is performed before command execution.
- Unknown command names and unknown error codes fail schema validation.
- Command-response correlation is validated using `in_reply_to` linkage checks in `contracts/validation/run-validation.mjs`.
