# Contracts Validation Gates

Required local and CI gates for OfficeClaw contract validation.

## Local Gate Commands

From repo root:

```bash
npm --prefix contracts ci
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```

## `validate` Coverage

`npm --prefix contracts run validate` covers:

- Identifier, command, entity, protocol envelope, and scene-manifest schema validation.
- Positive and negative fixture suites under `contracts/fixtures`.
- Lifecycle transition constraints for tasks, decisions, and artifacts.
- Ack/error terminal-response correlation invariants.
- Cross-entity reference integrity checks.
- Scene manifest consistency checks, including POI uniqueness, nav-anchor validity, object/POI routing integrity, and navigation-grid shape checks.
- Validation of the canonical runtime scene file at `assets/scenes/cozy_office_v0.scene.json`.

## Required Pass Criteria

1. `validate` exits `0` with all schema + fixture + invariant checks passing.
2. `validate:session-key` exits `0` with no stability or collision failures.
3. Contract-validation steps are executed for any change touching protocol/domain/schema/fixtures/scene contracts.

## CI Gate

GitHub Actions workflow:

- `.github/workflows/contracts-validation.yml`

Trigger policy:

- pull requests
- pushes to `main` and `master`

CI executes:

1. `npm --prefix contracts ci`
2. `npm --prefix contracts run validate`
3. `npm --prefix contracts run validate:session-key`

## Failure Handling Guidance

When either command fails:

1. Do not close the active `br` issue.
2. Capture failing command output in the work thread (`[br-###]`).
3. Classify failure as schema/fixture mismatch, invariant regression, or environment setup issue.
4. Fix and re-run until both commands pass or an explicit exception is approved.
5. If blocked by cross-issue dependency, set issue status to `blocked` in `br` and send a high-importance unblock request.
