# Meshy GLB Work Order

Generated: 2026-02-15T15:08:17Z
Project root: `.`
Asset ID: `prop_dev_desk`

## Inputs

### Image References
- `reports/client-polish/affordance-audit/20260215T131640Z/04-artifact-viewer.png`

### Contract Sources
- Plan: `PLAN.md`
- Scene manifest: `assets/scenes/cozy_office_v0.scene.json`
- Renderer: `apps/client-web/src/scene/agents/AgentRenderer.tsx`

## Runtime Animation Contract

Required:
- `Idle`
- `Walk`
- `Work_Typing`
- `Think`

Optional:
- (none)

Renderer required clips: `["Idle","Walk","Work_Typing","Think"]` (matches required plan contract)

## Meshy Generation Brief

Use the provided images to keep silhouette, proportions, and outfit direction consistent across all outputs.

1. Generate/iterate base character GLB from image references.
2. Rig the same character identity.
3. Generate animation clips aligned to canonical contract.
4. Export GLB assets into `assets/glb/`.

Suggested Meshy action intent by canonical clip:
- `Idle`: Idle / standing-breathing
- `Walk`: Walking / casual walk
- `Work_Typing`: Seated work loop (typing-like stand-in if true typing is unavailable)
- `Think`: Thoughtful idle (head-scratch/pondering style)
- `Carry`: Carry object walk (optional)

## Scene Alignment Snapshot

POIs (first 10):
- `poi_reception_inbox`
- `poi_task_board`
- `poi_delivery_shelf`

Highlight nodes referenced in scene manifest (first 20):
- `Head`
- `Hips`
- `LeftHand`
- `RightHand`
- `Spine`

## Post-Export Normalization

Canonical naming aliases used in this project:
- `Idle` <- `Idle_3`, `Standing`
- `Walk` <- `Walking`, `Running`
- `Work_Typing` <- `Sitting_Answering_Questions`, `Sitting`
- `Think` <- `Sitting_Clap`, `Standing`, `No`, `Yes`
- `Carry` <- `Carry_Heavy_Object_Walk`

Normalize:
```bash
node tools/glb-normalize-clips.mjs --in assets/glb/prop_dev_desk_animations.glb
```

Preflight:
```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```

## Acceptance Checklist

- [ ] Required clips exist with canonical names: Idle, Walk, Work_Typing, Think
- [ ] Optional clips reviewed: none
- [ ] Character scale/pivot warnings reviewed and corrected if needed
- [ ] Scene manifest GLB references resolve under `assets/glb`
- [ ] Preflight report has no `ERROR` entries
- [ ] Runtime smoke test confirms state-to-clip playback

## Additional Notes

bd-9hcf env asset generation run
