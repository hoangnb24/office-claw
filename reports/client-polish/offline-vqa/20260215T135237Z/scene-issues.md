# GLB Preflight Report

Generated: 2026-02-15T13:52:53.155Z
Scene manifest: `assets/scenes/cozy_office_v0.scene.json`
Asset root: `assets/glb`

## Summary

- Files checked: 8
- Required highlight nodes checked: 5
- Errors: 0
- Warnings: 4

## Findings

| Severity | File | Check | Message | Remediation |
|---|---|---|---|---|
| WARN | `assets/glb/agent1_animations.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| WARN | `assets/glb/agent1_skeleton.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| WARN | `assets/glb/desk.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| WARN | `assets/glb/shelf.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |

## Remediation Guide

- Fix `ERROR` items before using assets in runtime.
- `WARN` items should be reviewed and accepted or corrected explicitly.
- Re-run: `node tools/glb-preflight.mjs --scene <scene> --asset-root <dir> --report <path>`
