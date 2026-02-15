# GLB Clip Normalizer (No Blender)

Use this when Meshy exports valid animations but clip names do not match the OfficeClaw runtime contract.

## Runtime clip contract

Required:
- `Idle`
- `Walk`
- `Work_Typing`
- `Think`

Optional:
- `Carry`

## Script

`tools/glb-normalize-clips.mjs`

Default preset:
- `meshy-agent-v0`

Preset aliases:
- `Idle` <- `Idle_3`, `Standing`
- `Walk` <- `Walking`, `Running`
- `Work_Typing` <- `Sitting_Answering_Questions`, `Sitting`
- `Think` <- `Sitting_Clap`, `Standing`, `No`, `Yes`
- `Carry` <- `Carry_Heavy_Object_Walk`

## Commands

Preview only:

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --dry-run
```

Normalize in place:

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb
```

Write to a new file:

```bash
node tools/glb-normalize-clips.mjs \
  --in assets/glb/agent1_animations.glb \
  --out assets/glb/agent1_animations.normalized.glb
```

## Validate after normalization

```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```

## Notes

- This script renames clip names inside GLB JSON metadata only.
- It does not retarget skeletons or fix root motion.
- Keep canonical names in final asset packs even if runtime supports temporary aliases.
