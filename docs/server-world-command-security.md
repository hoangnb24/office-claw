# Server-World Command Security (bd-114)

`apps/server-world/src/worldServer.mjs` and `apps/server-world/src/commandRouter.mjs` now enforce a stricter command-security baseline for v0.

## Security Controls

- Strict server-side command validation:
  - allowlist of supported command names
  - command-specific required fields
  - rejection of unexpected extra fields per command payload
- Deterministic text sanitization policy for user-provided text fields:
  - normalize Unicode (`NFKC`)
  - strip control characters
  - normalize whitespace
  - trim and bound max length
- Session-level command rate limiting:
  - bounded command count per sliding window
  - deterministic `RATE_LIMITED` protocol error when exceeded

## Sanitized Text Fields

- `submit_request.text`
- `resolve_decision.choice`
- `request_changes.instructions`
- `split_into_tasks.task_titles[]`

Sanitization is applied before command handling and before command journaling/event emission.

## Runtime Observability

- `/health` now includes `command_security`:
  - `rate_limited`
  - `validation_failed`
  - `sanitized_text_fields`
  - `rate_limit.max_commands`
  - `rate_limit.window_ms`
- Server accessor: `getCommandSecurityStats()`

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
