# Contracts Epic Validation (bd-q2m)

This report validates closure readiness for `bd-q2m` (Contracts, Canonical Models, and Shared Types).

## Dependency closure

All dependency beads are closed:
- `bd-19o` domain glossary and invariants
- `bd-r7s` protocol envelope/message schemas
- `bd-vvi` scene manifest schemas
- `bd-3sz` command taxonomy and normalized error model
- `bd-2gj` golden flow fixtures
- `bd-2of` reconnect/resync extension
- `bd-18y` compatibility/versioning policy

Verification command:

```bash
br show bd-q2m --json
```

## End-to-end validation scenario

### Scenario: contract pipeline catches drift before runtime

1. Canonical schemas and fixtures exist in `contracts/schemas` and `contracts/fixtures`.
2. Validation harness is executed:

```bash
npm --prefix contracts run validate
```

3. Expected outcome:
- envelope/domain/command/scene schemas validate
- golden canonical flows validate ordering and references
- invalid fixtures fail deterministically with expected classes

Observed result:
- `All contract validations passed.`

## User-visible/engineering outcomes

- Contributors now have one canonical contract source of truth.
- Flow fixtures cover submit/kickoff, blocked decision lifecycle, and artifact approval lifecycle.
- Protocol version negotiation/fail-fast behavior is explicitly documented and test-aligned.

## Operational considerations captured

- Contract docs and schema sources:
  - `DOMAIN_MODEL.md`
  - `PROTOCOL.md`
  - `SCENE_MANIFESTS.md`
  - `docs/protocol-compatibility-policy.md`
- Validation mechanism:
  - `contracts/validation/run-validation.mjs`
  - `npm --prefix contracts run validate`
- Drift prevention inputs:
  - golden fixtures and invalid fixtures under `contracts/fixtures`

## Outcome

`bd-q2m` success criteria are satisfied:
- demonstrable behavior via passing validation harness
- end-to-end contract scenario reproduced
- testing/docs operational safeguards documented
