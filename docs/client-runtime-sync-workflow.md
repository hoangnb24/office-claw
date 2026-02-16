# Client Runtime Sync Workflow

Related bead: `bd-bsw`

This workflow exposes runtime asset sync and drift verification through npm scripts in `apps/client-web/package.json`.

## Source of truth and targets

- Authoring source:
  - `assets/glb/**`
  - `assets/scenes/**`
- Runtime-served outputs:
  - `apps/client-web/public/assets/**`
  - `apps/client-web/public/scenes/**`

## Commands

From repo root:

```bash
# verify drift only (non-zero exit if sync is needed)
npm --prefix apps/client-web run assets:verify

# sync missing/changed runtime files
npm --prefix apps/client-web run assets:sync

# sync and remove stale runtime files not present in source
npm --prefix apps/client-web run assets:sync:prune
```

## Expected output

`tools/sync-runtime-assets.mjs` prints a deterministic summary:

- mode (`check` or `sync`)
- copied / updated / unchanged counts
- stale and pruned counts
- explicit file list for copied/updated entries

In `assets:verify`, any detected drift exits non-zero so the command can be used in local preflight checks and CI.

## Troubleshooting

- `Source directory does not exist`: ensure scripts include explicit `--source-glb` / `--source-scenes` args; direct tool usage can pass these explicitly.
- Verify fails with stale entries: run `assets:sync` (or `assets:sync:prune` if stale files should be removed).
- Verify fails with copied/updated entries: run `assets:sync`, then re-run `assets:verify`.
