# Client Asset Compression Workflow (`bd-295o`)

Last updated: 2026-02-15

## Goal

Provide one reproducible mesh/texture compression path for canonical authoring GLBs while keeping source assets unchanged.

## Tooling

- Runner: `tools/compress-runtime-assets.mjs`
- Compression backend: `npx @gltf-transform/cli@4.2.1`
- Mesh compression: Draco (`gltf-transform draco`)
- Texture compression:
  - preferred when available: KTX2/Basis ETC1S (`gltf-transform etc1s`)
  - fallback: WebP (`gltf-transform webp`) when `ktx` binary is unavailable

## Default Scope

Runner defaults target core scene assets:

1. `office_shell.glb`
2. `inbox.glb`
3. `task_board.glb`
4. `blocker_cone.glb`
5. `desk.glb`
6. `shelf.glb`

Input root: `assets/glb`  
Output root: `assets/glb/compressed`

## Commands

Dry run:

```bash
node tools/compress-runtime-assets.mjs --dry-run
```

Execute and write compression summary:

```bash
node tools/compress-runtime-assets.mjs \
  --report reports/asset-compression-bd-295o.md
```

Validate compressed output compatibility against manifest references:

```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb/compressed \
  --report reports/glb-preflight-compressed-bd-295o.md
```

## Reprocessing and Recovery

1. Source-of-truth assets remain under `assets/glb/**`.
2. Compressed outputs are generated into `assets/glb/compressed/**`.
3. Regenerate outputs by rerunning the script; no manual edits to compressed files are required.
