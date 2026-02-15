# Repository Layer and Transaction Boundaries (`bd-2sk`)

Last updated: 2026-02-14

## Scope

This layer provides:
- CRUD/data-access abstractions for core world entities
- atomic transaction wrappers for lifecycle-critical updates
- test doubles for integration harnesses

Implemented under `packages/repository`.

## Module layout

- `packages/repository/src/inMemoryAdapter.mjs`
  - in-memory datastore adapter used as a test double
  - supports `read` and atomic `transaction` execution
- `packages/repository/src/repositoryLayer.mjs`
  - domain repository API:
    - `projects`, `tasks`, `decisions`, `artifacts`
    - `events`, `officeDecor`, `commandReceipts`
  - lifecycle transaction wrappers:
    - `resolveDecisionAndResumeTask(...)`
    - `approveArtifactAndCompleteTask(...)`
- `packages/repository/src/index.mjs`
  - package exports
- `packages/repository/test/repository.test.mjs`
  - runnable behavioral checks

## Transaction boundary policy

All multi-entity lifecycle mutations must run through `withTransaction` so writes commit or rollback together.

Examples of atomic boundaries:
- resolving a decision and resuming a blocked task
- approving an artifact and marking task done
- writing command receipt + associated event append

## Test double strategy

`InMemoryAdapter` is the default integration test double:
- deterministic state cloning per transaction
- rollback on thrown errors
- sequence generation for append-only events per project
- no external DB dependency required

This supports fast harness tests before wiring to a concrete SQL adapter.

## Validation

Run:

```bash
npm --prefix packages/repository test
```

Current test coverage:
- CRUD path for projects/tasks
- rollback semantics on failed transaction
- lifecycle wrapper state transitions
- idempotent command receipt recording
