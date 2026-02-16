# Contracts Package

This package defines canonical OfficeClaw contracts for identifiers, entities, protocol envelopes, command payloads, scene manifests, and lifecycle guards.

## Files

- `types/domain.ts`: Shared TypeScript domain type contracts.
- `types/commands.ts`: Typed command payloads and normalized ack/error policy model.
- `schemas/identifiers.schema.json`: Canonical ID patterns.
- `schemas/commands.schema.json`: Command payload contracts and ack/error payload contracts.
- `schemas/entities.schema.json`: Project/agent/task/decision/artifact schema rules.
- `schemas/protocol-envelope.schema.json`: Realtime message envelope and type-specific payload requirements.
- `schemas/scene-manifest.schema.json`: Scene/POI/object/navigation/spawn/decor manifest schema rules.
- `fixtures/golden-session.fixture.json`: Positive end-to-end fixture.
- `fixtures/README.md`: Canonical fixture index and validation intent.
- `fixtures/hello-handshake.fixture.json`: Canonical hello/hello_ack and incompatible-version handshake cases.
- `fixtures/subscribe-initial-snapshot.fixture.json`: Subscribe channel selection with initial snapshot push case.
- `fixtures/heartbeat-policy.fixture.json`: 15s ping / 45s timeout heartbeat policy fixture.
- `fixtures/command-taxonomy.fixture.json`: Positive command catalog and ack/error correlation fixture.
- `fixtures/required-fields.fixture.json`: Required-field negative cases across protocol message types.
- `fixtures/golden-flow-submit-kickoff.fixture.json`: Golden flow fixture for submit request -> kickoff -> tasks created.
- `fixtures/golden-flow-artifact-approve.fixture.json`: Golden flow fixture for artifact delivered -> approve -> task done.
- `fixtures/golden-flow-blocked-decision.fixture.json`: Golden flow fixture for blocked decision -> resolve -> task resume.
- `fixtures/invalid-ids.fixture.json`: Negative malformed-ID fixture.
- `fixtures/invalid-payloads.fixture.json`: Negative protocol payload fixtures with deterministic error classes.
- `fixtures/invalid-ack-error-correlation.fixture.json`: Negative one-terminal-response correlation fixtures.
- `fixtures/illegal-transitions.fixture.json`: Negative lifecycle transition fixture.
- `fixtures/invalid-scene-manifest.fixture.json`: Negative scene manifest fixtures for schema and consistency checks.
- `utils/session-key.mjs`: Deterministic OpenClaw session key strategy helpers.
- `validation/run-validation.mjs`: Schema + fixture + invariant validator runner.
- `validation/session-key-validation.mjs`: Session key stability and collision validation.
- `../assets/scenes/cozy_office_v0.scene.json`: Canonical runtime scene manifest validated by `run-validation.mjs`.

## Validation

```bash
npm --prefix contracts install
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```

## Scene Contract Notes

`schemas/scene-manifest.schema.json` requires full POI interaction contracts and navigation metadata. The canonical scene file is validated against both schema and higher-level consistency invariants during `npm --prefix contracts run validate`.
