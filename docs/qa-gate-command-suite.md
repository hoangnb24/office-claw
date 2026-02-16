# QA Gate Command Suite

Related bead: `bd-293o`

This is the canonical QA gate command suite for Phase 9 polish signoff.

## Single runner

```bash
node tools/qa/run-qa-gates.mjs
```

The runner executes checks in this order:

1. `npm --prefix apps/client-web run typecheck`
2. `npm --prefix apps/client-web run build`
3. `npm --prefix contracts run validate`
4. `npm --prefix contracts run validate:session-key`
5. `npm --prefix apps/client-web run assets:verify`
6. `node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md`
7. `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md`

## Partial execution (for fast triage)

```bash
node tools/qa/run-qa-gates.mjs --only client
node tools/qa/run-qa-gates.mjs --only contracts
node tools/qa/run-qa-gates.mjs --only preflight
```

Dry-run command preview:

```bash
node tools/qa/run-qa-gates.mjs --only client,contracts --dry-run
```

## Pass criteria

1. All selected commands return exit code `0`.
2. Runner prints `PASS` for each selected check and finishes with `All selected checks passed.`
3. For full-gate runs, `reports/asset-provenance-ledger.md` and `reports/glb-preflight-report.latest.md` are regenerated with current findings.

## Fail criteria

Any non-zero command exit is a QA gate failure.

Typical failure classes:

- Type/build regression in client runtime code.
- Contract/schema/fixture regression in `contracts/validation`.
- Runtime asset drift (`assets:verify`).
- Missing Meshy manifest evidence or unresolved placeholder/hash reuse (`asset-provenance-ledger` strict mode).
- GLB/manifest preflight issues.

## Failure handling

1. Treat bead as incomplete while gate fails.
2. Post the failing command id and first actionable error line in the bead thread.
3. Fix and re-run the same gate command until it passes.
4. If blocked by another active bead, move bead to `blocked` in `br` and send a high-importance unblock message.
