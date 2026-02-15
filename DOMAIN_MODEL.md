# Domain Model and Invariants

This document is the canonical contract for entity identifiers, entity shapes, and lifecycle invariants used across OfficeClaw world state, manifests, and realtime protocol messages.

## Canonical Identifiers

All identifiers are lowercase snake-case with stable prefixes.

| Entity | Field | Pattern | Example |
|---|---|---|---|
| Agent | `agent_id` | `^agent_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` | `agent_research_1` |
| Project | `project_id` | `^proj_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` | `proj_abc` |
| Task | `task_id` | `^task_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` | `task_1` |
| Artifact | `artifact_id` | `^art_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` | `art_1` |
| Decision | `decision_id` | `^dec_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` | `dec_1` |
| POI | `poi_id` | `^poi_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` | `poi_task_board` |
| Message | `id` | `^[a-z]+_[A-Za-z0-9][A-Za-z0-9_-]*$` | `evt_123` |

## Canonical Entity Status Sets

- `project.status`: `created | planning | executing | blocked | completed | archived`
- `task.status`: `planned | in_progress | blocked | done | cancelled`
- `decision.status`: `open | resolved | cancelled`
- `artifact.status`: `created | delivered | in_review | approved | changes_requested | superseded | archived`
- `agent.state`: `IdleAtHome | WalkingToPOI | WorkingAtPOI | InMeeting | DeliveringArtifact | SeekingUserDecision | WalkingToPlayer | BlockedWaiting`

## Lifecycle Transition Guards

### Task transitions
- `planned -> in_progress | cancelled`
- `in_progress -> blocked | done | cancelled`
- `blocked -> in_progress | cancelled`
- `done ->` (terminal)
- `cancelled ->` (terminal)

### Decision transitions
- `open -> resolved | cancelled`
- `resolved ->` (terminal)
- `cancelled ->` (terminal)

### Artifact transitions
- `created -> delivered | superseded`
- `delivered -> in_review | approved | changes_requested | superseded`
- `in_review -> approved | changes_requested | superseded`
- `changes_requested -> in_review | superseded`
- `approved -> archived | superseded`
- `superseded -> archived`
- `archived ->` (terminal)

## Cross-Entity Invariants

- Every `task.project_id`, `artifact.project_id`, and `decision.project_id` must reference an existing `project.project_id`.
- A `task.assignee` must reference an existing `agent.agent_id`.
- A `decision.task_id` (if present) must reference an existing `task.task_id`.
- An `artifact.task_id` (if present) must reference an existing `task.task_id`.
- `snapshot` payloads are authoritative and must only include entities that satisfy the above constraints.
- Protocol `event` and `command` payload references must use canonical IDs and must not point to unknown entities.

## Schema and Validation Artifacts

- Shared TypeScript model types: `contracts/types/domain.ts`
- JSON Schemas:
  - `contracts/schemas/identifiers.schema.json`
  - `contracts/schemas/entities.schema.json`
  - `contracts/schemas/protocol-envelope.schema.json`
  - `contracts/schemas/scene-manifest.schema.json`
- Validation fixtures:
  - Golden positive fixture: `contracts/fixtures/golden-session.fixture.json`
  - Negative malformed ID fixture: `contracts/fixtures/invalid-ids.fixture.json`
  - Negative invalid protocol payload fixtures: `contracts/fixtures/invalid-payloads.fixture.json`
  - Negative illegal transition fixture: `contracts/fixtures/illegal-transitions.fixture.json`
- Validation runner: `contracts/validation/run-validation.mjs`

Run validations with:

```bash
npm --prefix contracts run validate
```
