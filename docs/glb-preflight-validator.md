# GLB Preflight Validator

Related bead: `bd-1xq`

## Purpose
Catch asset-pack issues before runtime by validating:
- required animation clips on agent GLBs
- scene manifest node hook references (`highlight_nodes`)
- scale/pivot sanity heuristics

## Command
```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```

## Inputs
- Scene manifest (`--scene`)
- GLB directory (`--asset-root`)

## Outputs
- Markdown report (`--report`) with:
  - summary counts
  - severity-tagged findings
  - remediation guidance
- Report template for review workflows:
  - `reports/glb-preflight-report.template.md`

## Validation rules
- Agent animation bundles (filename includes both `agent` and `animation`) must contain:
  - `Idle`
  - `Walk`
  - `Work_Typing`
  - `Think`
- Manifest-referenced GLB basenames must exist in the asset root.
- Required highlight node names in scene manifest must exist in at least one checked GLB.
- Scale and pivot checks emit warnings/errors for suspicious transforms.

## Exit behavior
- Exit code `0`: no errors found.
- Exit code `1`: one or more errors found (report still generated).

## Fast remediation for Meshy clip naming

If Meshy clip names do not match the contract, normalize first:

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb
```

Then re-run preflight.
