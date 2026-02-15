# Meshy Polished Pipeline (Image -> GLB)

This is the production path for generating and downloading Meshy assets from reference images while staying aligned with OfficeClaw contracts.

## 1) Dedicated venv

```bash
python3 -m venv .venv-meshy
source .venv-meshy/bin/activate
pip install -r tools/requirements-meshy.txt
```

## 2) Set API key

```bash
export MESHY_API_KEY="<your_meshy_token>"
```

## 3) Generate polished base GLB from images

Use one image for `image-to-3d`, or 2-4 images for `multi-image-to-3d`.

Dry run first (no API calls):

```bash
python tools/meshy_pipeline.py \
  --image images/agent_front.jpeg \
  --image images/agent_back.jpeg \
  --asset-id agent1 \
  --dry-run
```

Then run the real generation:

```bash
python tools/meshy_pipeline.py \
  --image images/agent_front.jpeg \
  --image images/agent_back.jpeg \
  --asset-id agent1 \
  --output-dir assets/glb \
  --manifest-out reports/meshy-agent1-manifest.json
```

Output:
- `assets/glb/agent1_generated.glb`

## 4) Optional rig + animation downloads

Prepare action IDs in:
- `tools/meshy-actions.officeclaw.example.json`

Then run:

```bash
python tools/meshy_pipeline.py \
  --image images/agent_front.jpeg \
  --image images/agent_back.jpeg \
  --asset-id agent1 \
  --output-dir assets/glb \
  --rig \
  --actions-json tools/meshy-actions.officeclaw.example.json \
  --manifest-out reports/meshy-agent1-manifest.json
```

Outputs:
- `assets/glb/agent1_generated.glb`
- `assets/glb/agent1_rigged.glb` (if rigging returns a rigged GLB)
- `assets/glb/agent1_<Clip>.glb` for each animation action

## 5) Enforce OfficeClaw contract

If you produce an animation bundle file:

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb
```

Then run preflight:

```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```

## Notes

- Meshy API assets have retention limits; download and store immediately.
- Canonical runtime clips remain: `Idle`, `Walk`, `Work_Typing`, `Think`, optional `Carry`.
