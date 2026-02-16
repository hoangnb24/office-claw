# Asset Provenance Ledger (`bd-2yns`)

Generated at: `2026-02-15T14:51:15Z`  
Agent: `RainyDune`

## Scope

Publish deterministic provenance + placeholder-hash audit across required Phase 2 production assets, including both canonical and runtime-mirror paths.

## Command Evidence

```bash
node tools/asset-provenance-ledger.mjs
```

Outputs:

1. `tools/asset-provenance-ledger.mjs`
2. `reports/asset-provenance-ledger.md`

## Required Asset Coverage

Covered IDs:

1. `office_shell`
2. `prop_inbox`
3. `prop_task_board`
4. `prop_delivery_shelf`
5. `prop_dev_desk`
6. `prop_blocker_cone`
7. `agent_base_skeleton`
8. `agent_animation_bundle`

Per-row ledger columns include:

1. asset ID
2. canonical path
3. canonical SHA-256
4. runtime mirror path
5. runtime mirror SHA-256
6. source type (`meshy-live`, `legacy-approved`, `placeholder-blocked`)
7. evidence links
8. related br IDs

## Placeholder-Hash Blockers Found

Current blocker clusters captured in ledger:

1. `ed52f719...` reused by `office_shell`, `prop_inbox`, `prop_task_board`, `prop_blocker_cone`
2. `d0ff59bf...` reused by `prop_delivery_shelf`, `prop_dev_desk`, `agent_base_skeleton`

Additional blocker signal:

1. 1664-byte tiny GLBs detected in the first cluster.

## Traceability

Referenced in ledger:

1. `bd-zzou`
2. `bd-dok7`
3. `bd-9hcf`
4. `bd-18j1`
5. `bd-2yns`

Supporting artifacts:

1. `reports/p2r-kickoff.bd-zzou.md`
2. `reports/meshy-credential-check.bd-dok7.md`
3. `reports/asset-budget-summary.md`

## Status

`bd-2yns` has a reproducible ledger + blocker audit implementation in place. Final closeout remains dependency-gated on live Meshy generation outputs (`bd-9hcf`, `bd-18j1`) and credential unblock (`bd-dok7`).

## Completion Update (2026-02-15)

Upstream dependency chain has now been completed:

1. `bd-dok7` closed
2. `bd-9hcf` closed
3. `bd-18j1` closed

Fresh strict ledger gate evidence:

```bash
node tools/asset-provenance-ledger.mjs \
  --strict \
  --require-manifests \
  --out reports/asset-provenance-ledger.md
```

Observed result: **PASS** (`[provenance-gate] PASS: no blockers detected.`).

`bd-2yns` acceptance is now satisfied end-to-end.
