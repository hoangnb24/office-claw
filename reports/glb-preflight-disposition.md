# GLB Preflight Warning Disposition

Related bead: `bd-24s`

## Command Evidence
- `node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --dry-run`
  - Result: required clip contract already satisfied (`Idle`, `Walk`, `Work_Typing`, `Think` present); no renames applied.
- `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.md`
  - Result: **PASS** (`Errors: 0`, `Warnings: 4`).

## Warning Review
| File | Warning | Disposition | Follow-up |
|---|---|---|---|
| `assets/glb/agent1_animations.glb` | Armature scale flagged as unusual (`~0.01`) | Accepted for now; runtime behavior currently stable and contract gate is non-blocking for this warning class. | Revisit in asset compression/normalization follow-up (`bd-295o`) with source export-unit cleanup. |
| `assets/glb/agent1_skeleton.glb` | Armature scale flagged as unusual (`~0.01`) | Accepted for now; skeleton file is not currently manifest-bound runtime geometry. | Revisit in asset compression/normalization follow-up (`bd-295o`). |
| `assets/glb/desk.glb` | Armature scale flagged as unusual (`~0.01`) | Accepted for now to avoid blocking current polish phase while functional checks are clean. | Re-export with normalized unit scale in next asset remediation pass. |
| `assets/glb/shelf.glb` | Armature scale flagged as unusual (`~0.01`) | Accepted for now to keep preflight non-blocking while no clip/highlight/manifest errors remain. | Re-export with normalized unit scale in next asset remediation pass. |

## Gate Status
- Blocking errors: `0`
- Required clip contract: satisfied
- Warning review: completed and dispositioned in this report
