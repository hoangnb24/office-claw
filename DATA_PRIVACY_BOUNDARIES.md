# DATA_PRIVACY_BOUNDARIES.md

Last updated: 2026-02-14
Related bead: `bd-3en`

## Purpose
Define data classification, retention/deletion policy, and redaction boundaries for OfficeClaw v0 so implementation work can proceed with explicit privacy constraints.

## Privacy Boundary Summary
- OfficeClaw stores operational data needed to run the world simulation and review deliverables.
- Sensitive user-provided content is minimized in telemetry/logging and retained only as long as needed for product operation, debugging, and audit obligations.
- Raw chain-of-thought or hidden model reasoning is not persisted in user-visible surfaces.

## Data Classification

| Class ID | Data class | Typical sources | Sensitivity | User impact if exposed |
|---|---|---|---|---|
| DC-01 | Chat content (BD/user) | `chat` messages, prompt inputs | High | Could reveal project intent or confidential instructions |
| DC-02 | Event timeline data | semantic events, task transitions | Medium | Reveals workflow activity and project cadence |
| DC-03 | Artifacts and revisions | deliverables, review notes | High | May contain proprietary business output |
| DC-04 | Decision records | blocker prompts, choices, notes | Medium | Reveals internal priorities and constraints |
| DC-05 | Operational logs | server/app logs, error traces | Medium-High | May leak IDs/content if unredacted |
| DC-06 | Telemetry and analytics | performance metrics, usage counters | Low-Medium | Usually aggregate, but can leak behavior patterns |
| DC-07 | Identity/session metadata | agent IDs, session keys, auth metadata | High | Could enable impersonation/replay if mishandled |

## Retention and Deletion Policy

| Data class | Default retention | Deletion trigger | Deletion method | Notes |
|---|---|---|---|---|
| DC-01 Chat content | 90 days | user delete request, project archive purge | hard delete of message body + attachment refs | Keep minimal metadata for audit if required |
| DC-02 Event timeline | 180 days | project archive purge | hard delete or compacted archive purge | Needed for replay/debug in v0 |
| DC-03 Artifacts/revisions | 365 days | project deletion or explicit artifact delete | hard delete content blobs + metadata refs | Version lineage kept until delete |
| DC-04 Decision records | 180 days | project archive purge | hard delete with decision ID tombstone optional | Preserve minimal analytics counters only |
| DC-05 Operational logs | 30 days | rolling window expiry | automated log rotation and purge | Redacted logs only |
| DC-06 Telemetry | 90 days raw, 365 days aggregate | rolling window expiry | purge raw rows, keep aggregate metrics | Aggregates must be non-identifying |
| DC-07 Identity/session metadata | session lifetime + 7 days | session close + expiry | cryptographic key invalidation + metadata purge | Never store secret tokens in plaintext logs |

## Redaction Requirements

### Logs
- Never log raw user request bodies by default.
- Hash or truncate identifiers in info-level logs when full IDs are not required.
- Strip secrets, auth headers, session keys, and attachment URLs from logs.
- Error logs may include error class and correlation ID, but not raw confidential payloads.

### Telemetry
- Emit aggregate counters and timings, not raw message content.
- Use stable pseudonymous IDs for analytics joins; avoid direct user identifiers.
- For command failures, log error class and surface context only (`panel`, `command`, `result`).

### Exported traces and debug bundles
- Exports must pass a redaction pass before download/sharing.
- Redaction pass removes:
  - chat/artifact freeform text bodies (unless explicitly requested by authorized owner)
  - auth/session artifacts
  - raw prompt payloads
- Include manifest of removed fields to keep debugging transparent.

## Product-Level User Privacy Boundaries
- Users must be informed that:
  - task/events/artifact metadata is stored for workflow continuity and audit
  - chat and deliverables may be retained temporarily per policy
  - support/debug exports are redacted by default
- User-facing policy text should include:
  - what is stored
  - why it is stored
  - how long it is stored
  - how deletion requests are handled

## Access Control and Least Privilege
- Restrict raw content access (DC-01/DC-03/DC-07) to service roles that require it.
- Keep admin/support tooling read-scoped by default with explicit elevated workflow for sensitive access.
- Maintain audit logs for privileged reads and export actions.

## Compliance and Risk Assumptions

| Assumption/Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| No strict regulatory scope declared yet (e.g., HIPAA/PCI) | Unknown future gaps | Product lead | Revisit before external launch |
| Over-collection in logs during incident debugging | Privacy leakage | Backend lead | Enforce structured redaction middleware |
| Artifact content may include confidential material | High | Security + product | Access controls + retention limits + deletion workflow |
| Multi-agent traces may expose internal strategy text | Medium-High | Platform lead | Default-redacted exports and policy review gate |

## Implementation Controls
- Add redaction middleware at log emission boundary.
- Add retention jobs per class with explicit schedule and audit counters.
- Add data export pipeline with mandatory redaction stage.
- Add deletion endpoint/workflow that cascades across message, artifact, and log stores where applicable.

## Verification Checklist
- Each data class has explicit retention and deletion behavior.
- Redaction rules cover logs, telemetry, and exported traces.
- User-facing privacy boundaries are explicit and implementation-ready.
- Risks and owners are documented and actionable.
