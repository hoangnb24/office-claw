# QA Gate Command Suite

Canonical QA gate command suite for OfficeClaw runtime, contract, asset, and parity checks.

## Single Runner

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
7. `node tools/qa/check-offline-live-parity.mjs`
8. `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md`

## Partial Execution (Fast Triage)

```bash
node tools/qa/run-qa-gates.mjs --only client
node tools/qa/run-qa-gates.mjs --only contracts
node tools/qa/run-qa-gates.mjs --only preflight
node tools/qa/run-qa-gates.mjs --only parity
```

Dry-run command preview:

```bash
node tools/qa/run-qa-gates.mjs --only client,contracts --dry-run
```

## Group Definitions

- `client`: Typecheck + build
- `contracts`: Schema/fixture/invariant validation + session-key stability checks
- `preflight`: Runtime asset drift verification, provenance gate, and GLB preflight
- `parity`: Offline/live command-routing and microcopy parity regression check
- `all`: Entire suite (default)

## Pass Criteria

1. All selected commands return exit code `0`.
2. Runner prints `PASS` for each selected check.
3. Runner finishes with `[qa] All selected checks passed.`
4. Full runs regenerate `reports/asset-provenance-ledger.md` and `reports/glb-preflight-report.latest.md`.

## Fail Criteria

Any non-zero command exit is a QA gate failure.

Typical failure classes:

- Type/build regression in client runtime code.
- Contract/schema/fixture regression in `contracts/validation`.
- Runtime asset drift (`assets:verify`).
- Offline/live parity regression in command coverage or action-oriented microcopy.
- Missing Meshy manifest evidence or unresolved placeholder/hash reuse in provenance strict mode.
- GLB manifest/preflight violations.

## Failure Handling

1. Treat the active work item as incomplete while gates fail.
2. Post failing command id and first actionable error line in the work thread.
3. Fix and re-run the same gate command until it passes.
4. If blocked by another active work item, set status to `blocked` in `br` and send a high-importance unblock message.
