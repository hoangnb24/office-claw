# Asset Production Evidence (bd-3h3)

Generated: 2026-02-15T12:42:25Z

## Canonical P0 assets populated

| Canonical Path | Source Runtime Alias | SHA1 (canonical) | SHA1 (source) | Match | Size (bytes) |
|---|---|---|---|---|---|
| `assets/glb/inbox.glb` | `apps/client-web/public/assets/props/inbox.glb` | `b6111683d46c109f64b50c36b130a9f05fa6df64` | `b6111683d46c109f64b50c36b130a9f05fa6df64` | yes | 1664 |
| `assets/glb/task_board.glb` | `apps/client-web/public/assets/props/task_board.glb` | `b6111683d46c109f64b50c36b130a9f05fa6df64` | `b6111683d46c109f64b50c36b130a9f05fa6df64` | yes | 1664 |
| `assets/glb/blocker_cone.glb` | `apps/client-web/public/assets/props/blocker_cone.glb` | `b6111683d46c109f64b50c36b130a9f05fa6df64` | `b6111683d46c109f64b50c36b130a9f05fa6df64` | yes | 1664 |

## Validation

- Command: `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.bd-3h3.md`
- Report: `reports/glb-preflight-report.bd-3h3.md`
- Result: parser+manifest checks include the new canonical files; current preflight errors are existing clip-contract issues on `assets/glb/agent1_skeleton.glb` (not introduced by this bead).

## Scope notes

- This bead populates missing canonical P0 authoring files under `assets/glb` for inventory IDs locked in `CLIENT_ART_PRODUCTION_LIST.md`.
- Runtime alias files under `apps/client-web/public/assets/props` are unchanged.
