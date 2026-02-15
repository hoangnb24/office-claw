# Server-World Artifact Lifecycle and Review Hooks (`bd-1x9`)

Last updated: 2026-02-14

## Scope

Implemented deterministic artifact lifecycle orchestration in `apps/server-world/src/worldState.mjs` for:
- artifact version updates on review-change requests
- review transition hooks (`review_approved`, `review_changes_requested`) reflected in snapshot state
- split fan-out task creation tied to review state

## Behavior Added

### 1) Artifact status transition guards

Added explicit lifecycle guards aligned with `DOMAIN_MODEL.md` artifact transitions:
- `created -> delivered|superseded`
- `delivered -> in_review|approved|changes_requested|superseded`
- `in_review -> approved|changes_requested|superseded`
- `changes_requested -> in_review|superseded`
- `approved -> archived|superseded`
- `superseded -> archived`

Invalid transitions now fail deterministically at command application time.

### 2) Deterministic artifact versioning

On `request_changes`:
1. source artifact transitions to `changes_requested`
2. a deterministic next revision is created (`..._v{n+1}`) in `created`
3. revision transitions to `delivered` for shelf visibility

Revision IDs are generated from artifact base id + max observed version in state.

### 3) Review approval supersedes older revisions

On `approve_artifact`:
- target artifact transitions to `approved`
- older sibling revisions (same task/project/type) are transitioned to `superseded`
- linked task completion behavior remains intact

### 4) Split fan-out behavior tightened

On `split_into_tasks`:
- command is allowed only in review-active artifact states (`delivered|in_review|changes_requested`)
- `delivered` artifacts are promoted to `in_review`
- deterministic split tasks (`task_split_###`) are generated with normalized titles

## Tests Added

Extended `apps/server-world/test/simulation.test.mjs` with:
- `testArtifactLifecycleVersioningAndSplitFanout`

Coverage in this test:
- `request_changes` produces `art_research_report_v2` (`version=2`, `status=delivered`)
- `split_into_tasks` on revision creates deterministic fan-out tasks and marks revision `in_review`
- `approve_artifact` on latest revision marks it `approved`, supersedes prior revision, and completes linked task

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
