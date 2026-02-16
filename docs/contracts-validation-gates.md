# Contracts Validation Gates

Related bead: `bd-3md`

This document defines the required local and CI gates for contract validation.

## Local gate commands

From repo root:

```bash
npm --prefix contracts ci
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```

## Required pass criteria

1. `validate` exits `0` and reports all schema + fixture validations as passed.
2. `validate:session-key` exits `0` and reports no stability/collision failures.
3. No contract-validation step is skipped when preparing delivery for beads that touch protocol/domain/schema/fixtures.

## CI gate

GitHub Actions workflow:

- `.github/workflows/contracts-validation.yml`

Trigger policy:

- pull requests
- pushes to `main` and `master`

CI must execute:

1. `npm --prefix contracts ci`
2. `npm --prefix contracts run validate`
3. `npm --prefix contracts run validate:session-key`

## Failure handling guidance

When either command fails:

1. Do not close the active bead.
2. Capture failing command output in the bead thread (`[bd-###]`).
3. Classify failure:
   - schema/fixture contract mismatch
   - invariant regression
   - environment/dependency setup issue
4. Fix and re-run until both commands pass or an explicit exception is approved.
5. If blocked by cross-bead dependency, mark bead `blocked` in `br` and send a high-importance coordination message with required unblock.
