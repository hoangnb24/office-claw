# Cross-Tool Traceability Conventions (bd-3qc)

This convention keeps `br` issue tracking, MCP Agent Mail threads, labels, and audit notes aligned.

## Identifier mapping rules

- Primary rule: use the issue ID as the canonical thread key.
  - If issue ID is `bd-3qc`, then `thread_id` is `bd-3qc`.
  - When/if the workspace migrates to `br-###` IDs, use `br-###` directly as `thread_id`.
- Subject prefix must include the exact issue ID in square brackets.
  - Example: `[bd-3qc] Claimed and starting traceability conventions`
- File reservation reason must include the exact issue ID.
  - Example: `reason="bd-3qc"`
- Optional commit prefix should include the issue ID for grep-friendly history.
  - Example: `bd-3qc: add cross-tool traceability conventions`

## Threading conventions

- One workstream thread per issue ID.
- Use progress subjects:
  - `[bd-###] Claimed and starting ...`
  - `[bd-###] Progress: ...`
  - `[bd-###] Completed and closed`
- Do not mix multiple issue IDs in one thread unless documenting explicit dependency handoff.

## Label taxonomy rules

Use lowercase kebab-case labels and stable prefixes:

- `area:*` for domain ownership
  - examples: `area:client`, `area:server`, `area:contracts`, `area:workflow`
- `kind:*` for work intent
  - examples: `kind:feature`, `kind:bug`, `kind:docs`, `kind:infra`
- `state:*` for operational status
  - examples: `state:blocked`, `state:needs-ack`, `state:ready`
- `risk:*` for risk posture
  - examples: `risk:low`, `risk:medium`, `risk:high`

Rules:
- Keep labels additive (avoid overloaded single labels).
- Prefer adding a new prefixed label over free-form variants.
- Reuse existing labels when possible to keep query sets stable.

## Audit note examples

### Blocker raised

`br comments add bd-3qc --message "[audit][blocker] thread=bd-3qc blocked_by=bd-13k reason='Template dependency not complete' impact='Cannot finalize taxonomy conventions'"`

### Blocker cleared

`br comments add bd-3qc --message "[audit][unblocked] thread=bd-3qc cleared_by=bd-13k resolution='Templates completed and validated'"`

### Decision requested

`br comments add bd-3qc --message "[audit][decision-requested] thread=bd-3qc decision_id=dec_7 options='strict-prefixes|mixed-freeform' owner='product+eng'"`

### Decision resolved

`br comments add bd-3qc --message "[audit][decision-resolved] thread=bd-3qc decision_id=dec_7 choice='strict-prefixes' rationale='query consistency + lower drift'"`

### Optional structured audit entry

`br audit record --kind tool_call --issue-id bd-3qc --tool-name mcp_agent_mail.send_message --exit-code 0 --response "thread=bd-3qc subject=[bd-3qc] Completed and closed"`

## Validation checklist

1. Issue ID in `br` equals Agent Mail `thread_id`.
2. Mail subject contains `[<issue-id>]` prefix.
3. Reservation `reason` equals issue ID.
4. Labels follow prefixed taxonomy without free-form drift.
5. Blocker/decision comments include `[audit]` marker and `thread=<issue-id>`.
