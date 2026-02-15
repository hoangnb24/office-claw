# Contracts Package

This package defines canonical OfficeClaw contracts for IDs, entities, protocol envelope validation, and lifecycle transition guards.

## Files

- `types/domain.ts`: shared TypeScript type contracts.
- `types/commands.ts`: typed command payloads plus normalized ack/error policy model.
- `schemas/identifiers.schema.json`: canonical ID patterns.
- `schemas/commands.schema.json`: command payload contracts and normalized ack/error payload contracts.
- `schemas/entities.schema.json`: project/agent/task/decision/artifact schema rules.
- `schemas/protocol-envelope.schema.json`: realtime message envelope + type-specific payload requirements.
- `schemas/scene-manifest.schema.json`: scene/POI/object/navigation/spawn/decor manifest schema rules.
- `fixtures/golden-session.fixture.json`: positive end-to-end fixture.
- `fixtures/README.md`: canonical flow fixture index and validation intent.
- `fixtures/hello-handshake.fixture.json`: canonical hello/hello_ack and incompatible-version handshake cases.
- `fixtures/subscribe-initial-snapshot.fixture.json`: subscribe channel selection plus initial snapshot push case.
- `fixtures/heartbeat-policy.fixture.json`: 15s ping / 45s timeout heartbeat policy fixture.
- `fixtures/command-taxonomy.fixture.json`: positive command catalog + ack/error correlation fixture.
- `fixtures/required-fields.fixture.json`: required-field negative cases across protocol message types.
- `fixtures/golden-flow-submit-kickoff.fixture.json`: golden flow fixture for submit request -> kickoff -> tasks created.
- `fixtures/golden-flow-artifact-approve.fixture.json`: golden flow fixture for artifact delivered -> approve -> task done.
- `fixtures/golden-flow-blocked-decision.fixture.json`: golden flow fixture for blocked decision -> resolve -> task resume.
- `fixtures/invalid-ids.fixture.json`: negative malformed ID fixture.
- `fixtures/invalid-payloads.fixture.json`: negative protocol payload fixtures with deterministic error classes.
- `fixtures/invalid-ack-error-correlation.fixture.json`: negative one-terminal-response correlation fixtures.
- `fixtures/illegal-transitions.fixture.json`: negative lifecycle transition fixture.
- `fixtures/invalid-scene-manifest.fixture.json`: negative scene manifest fixtures for schema and consistency checks.
- `utils/session-key.mjs`: centralized deterministic OpenClaw session key strategy helpers.
- `validation/run-validation.mjs`: schema + invariant validator runner.
- `validation/session-key-validation.mjs`: session key stability/collision validation.
- `../assets/scenes/cozy_office_v0.scene.json`: valid sample manifest used by validation.

## Validation

```bash
npm --prefix contracts install
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```
