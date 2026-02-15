# GLB Preflight Report

Generated: 2026-02-14T14:09:31.694Z
Scene manifest: `assets/scenes/cozy_office_v0.scene.json`
Asset root: `assets/glb`

## Summary

- Files checked: 5
- Required highlight nodes checked: 5
- Errors: 8
- Warnings: 4

## Findings

| Severity | File | Check | Message | Remediation |
|---|---|---|---|---|
| ERROR | `assets/glb/agent1_animations.glb` | required_clips | Missing required clip "Idle". Found: Carry_Heavy_Object_Walk, Idle_3, Running, Sitting_Answering_Questions, Sitting_Clap, Walking. | Rename/export clip with the required canonical name. |
| ERROR | `assets/glb/agent1_animations.glb` | required_clips | Missing required clip "Walk". Found: Carry_Heavy_Object_Walk, Idle_3, Running, Sitting_Answering_Questions, Sitting_Clap, Walking. | Rename/export clip with the required canonical name. |
| ERROR | `assets/glb/agent1_animations.glb` | required_clips | Missing required clip "Work_Typing". Found: Carry_Heavy_Object_Walk, Idle_3, Running, Sitting_Answering_Questions, Sitting_Clap, Walking. | Rename/export clip with the required canonical name. |
| ERROR | `assets/glb/agent1_animations.glb` | required_clips | Missing required clip "Think". Found: Carry_Heavy_Object_Walk, Idle_3, Running, Sitting_Answering_Questions, Sitting_Clap, Walking. | Rename/export clip with the required canonical name. |
| WARN | `assets/glb/agent1_animations.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| ERROR | `assets/glb/agent1_skeleton.glb` | required_clips | Missing required clip "Idle". Found: Armature|clip0|baselayer. | Rename/export clip with the required canonical name. |
| ERROR | `assets/glb/agent1_skeleton.glb` | required_clips | Missing required clip "Walk". Found: Armature|clip0|baselayer. | Rename/export clip with the required canonical name. |
| ERROR | `assets/glb/agent1_skeleton.glb` | required_clips | Missing required clip "Work_Typing". Found: Armature|clip0|baselayer. | Rename/export clip with the required canonical name. |
| ERROR | `assets/glb/agent1_skeleton.glb` | required_clips | Missing required clip "Think". Found: Armature|clip0|baselayer. | Rename/export clip with the required canonical name. |
| WARN | `assets/glb/agent1_skeleton.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| WARN | `assets/glb/desk.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |
| WARN | `assets/glb/shelf.glb` | scale | Node "Armature" has unusual scale [0.009999999776482582,0.009999999776482582,0.009999999776482582]. | Confirm 1 unit = 1 meter and normalize object scale before export. |

## Remediation Guide

- Fix `ERROR` items before using assets in runtime.
- `WARN` items should be reviewed and accepted or corrected explicitly.
- Re-run: `node tools/glb-preflight.mjs --scene <scene> --asset-root <dir> --report <path>`
