# STORAGE_SCHEMA.md

Last updated: 2026-02-14
Related bead: `bd-psb`

## Purpose
Define a normalized persistence model, migration strategy, and indexing plan for OfficeClaw core world entities:
- projects
- tasks
- artifacts
- events
- decisions
- office decor

This design is optimized for server-authoritative realtime simulation and event-driven client sync.

## 1) Normalized Schema Overview

### Core tables
- `projects`: project lifecycle and metadata.
- `agents`: canonical agent registry.
- `project_agent_sessions`: per-project routing/session information.
- `tasks`: task lifecycle and assignment.
- `decisions`: blocker/resolution records.
- `artifacts`: deliverable lineage and review status.
- `world_events`: append-only semantic timeline (`event` channel source).
- `office_decor`: unlocked and placed cosmetic progression state.
- `command_receipts`: idempotency + audit boundary for client commands.
- `world_snapshots`: authoritative snapshot state checkpoints.

### Canonical ID and status alignment
- IDs and status values must align with `DOMAIN_MODEL.md`.
- Server validation rejects writes that violate canonical patterns and transitions.

## 2) Entity-to-Table Mapping

| Domain entity | Primary table | Notes |
|---|---|---|
| Project | `projects` | source for title/status and lifecycle timestamps |
| Agent | `agents` | static or slowly-changing identity metadata |
| Agent session routing | `project_agent_sessions` | deterministic OpenClaw session key per project/agent |
| Task | `tasks` | assignment, progress, and terminal outcomes |
| Decision | `decisions` | open/resolved/cancelled decision prompts |
| Artifact | `artifacts` | versioning, review states, shelf placement |
| Event timeline | `world_events` | append-only log with monotonic `seq` per project |
| Decor progression | `office_decor` | persistent visual unlock/placement state |
| Command audit/idempotency | `command_receipts` | command replay protection + deterministic ack/error correlation |
| Snapshot checkpoints | `world_snapshots` | low-frequency authoritative state materialization |

## 3) Realtime Query Paths and Indexing

### Hot reads
- Current project state
  - `projects` by `project_id`
  - open tasks by `(project_id, status)`
  - open decisions by `(project_id, status)`
  - latest artifacts by `(project_id, created_ts DESC)`
- Event feed
  - `world_events` by `(project_id, seq)` and `(project_id, ts)`
- Agent inspector
  - active tasks by `assignee_agent_id`, filtered by non-terminal statuses
- Delivery shelf
  - artifacts by `(project_id, poi_id, status)`

### Hot writes
- Append semantic event rows (`world_events`)
- Task status transitions (`tasks`)
- Decision resolution (`decisions`)
- Artifact version creation/status updates (`artifacts`)
- Snapshot checkpoint writes (`world_snapshots`)

### Required indexes
- `idx_tasks_project_status_updated`
- `idx_tasks_assignee_status`
- `idx_decisions_project_status_created`
- `idx_artifacts_project_status_created`
- `idx_events_project_seq` (unique)
- `idx_events_project_ts`
- `idx_snapshots_project_created`
- `idx_command_receipts_project_key`

## 4) Migration Strategy

### Migration sequence
1. `0001_world_schema.sql`
  - create normalized tables, constraints, and indexes
2. `0002_backfill_from_event_log.sql` (future)
  - replay historical event timeline to seed task/artifact/decision state
3. `0003_add_read_optimized_views.sql` (future)
  - add materialized/denormalized read views if needed

### Rollout strategy (safe deployment)
1. Create new tables with no destructive changes.
2. Deploy dual-write from server command/event handlers.
3. Backfill historical state in batches.
4. Verify read parity (`old reads == new reads`) with sampled checks.
5. Flip read path to new schema.
6. Remove old storage paths only after parity window completes.

### Failure/edge handling in migration
- If backfill fails mid-stream:
  - resume using last successful event `seq` per project.
- If parity mismatch is detected:
  - keep old read path active and emit high-severity diagnostics.
- If write contention spikes:
  - prioritize append-only `world_events` durability, defer snapshot compaction.

## 5) Consistency and Safety Constraints

### Referential integrity
- Every task/decision/artifact row references an existing `project_id`.
- Decision/artifact optional `task_id` must reference existing tasks when present.
- `project_agent_sessions` must reference valid project and agent rows.

### Transition guards
- Lifecycle transitions must be validated in service layer before update commit.
- Terminal-state transitions are rejected (`done/cancelled`, etc., per domain invariants).

### Idempotency and replay safety
- `command_receipts` stores `(project_id, idempotency_key)` with unique constraint.
- Duplicate command retries return prior recorded outcome.
- `world_events` enforces unique `(project_id, seq)` to prevent duplicate timeline entries.

## 6) Validation Checklist
- SQL migration creates all core entity tables and required indexes.
- Status checks match domain status sets from `DOMAIN_MODEL.md`.
- Referential constraints and uniqueness constraints are present.
- Migration strategy includes rollout, parity verification, and failure recovery.

## 7) Implementation Artifacts
- Schema/migration SQL: `migrations/0001_world_schema.sql`
