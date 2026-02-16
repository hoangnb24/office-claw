# GLB Preflight Report

Generated: 2026-02-15T13:00:35.343Z
Scene manifest: `assets/scenes/cozy_office_v0.scene.json`
Asset root: `assets/glb/compressed`

## Summary

- Files checked: 6
- Required highlight nodes checked: 5
- Errors: 0
- Warnings: 2

## Findings

| Severity | File | Check | Message | Remediation |
|---|---|---|---|---|
| WARN | `assets/glb/compressed/desk.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| WARN | `assets/glb/compressed/shelf.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |

## Remediation Guide

- Fix `ERROR` items before using assets in runtime.
- `WARN` items should be reviewed and accepted or corrected explicitly.
- Re-run: `node tools/glb-preflight.mjs --scene <scene> --asset-root <dir> --report <path>`
