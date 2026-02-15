# Canonical Fixture Set

These fixtures are executable contract references for protocol/order/lifecycle behavior.

## Canonical Flow Fixtures

- `golden-flow-submit-kickoff.fixture.json`
  - verifies `submit_request -> request_submitted -> request_accepted -> kickoff_started -> tasks_created`
- `golden-flow-artifact-approve.fixture.json`
  - verifies `artifact_delivered -> approve_artifact -> review_approved -> task_done`
- `golden-flow-blocked-decision.fixture.json`
  - verifies blocked flow `task_blocked -> decision_requested -> resolve_decision -> decision_resolved -> task_started`
- `golden-flow-assign-progress.fixture.json`
  - verifies assignment lifecycle `assign_task -> task_assigned -> task_started -> task_progress`
- `golden-flow-reconnect-resync.fixture.json`
  - verifies reconnect/resume semantics `hello(resume) -> hello_ack(resumed) -> subscribe -> snapshot -> replay events`
- `hello-handshake.fixture.json`
  - verifies `hello -> hello_ack` success path and incompatible-version `hello -> error` path
- `subscribe-initial-snapshot.fixture.json`
  - verifies subscribe channel payload and immediate initial snapshot semantics
- `heartbeat-policy.fixture.json`
  - verifies 15s ping cadence, nonce-matched pong replies, and 45s timeout envelope

## Supporting Fixtures

- `golden-session.fixture.json`: broad end-to-end baseline with entities and mixed message families.
- `command-taxonomy.fixture.json`: full command catalog plus deterministic ack/error correlations.
- `required-fields.fixture.json`: required-field negative coverage across envelope message families.
- `invalid-ids.fixture.json`: malformed ID rejection cases.
- `invalid-payloads.fixture.json`: invalid payloads with deterministic error classes.
- `invalid-ack-error-correlation.fixture.json`: negative command/ack/error correlation cases.
- `invalid-scene-manifest.fixture.json`: schema + consistency failures for manifest validation.
- `illegal-transitions.fixture.json`: illegal lifecycle transition rejection cases.

## Validation Command

```bash
npm --prefix contracts run validate
```
