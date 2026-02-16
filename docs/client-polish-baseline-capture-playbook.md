# Client Polish Baseline Capture Playbook (`bd-1gr`)

Last updated: 2026-02-16

## Purpose

Provide one repeatable baseline capture procedure for Phase 0 client-polish evidence:
- screenshots
- walkthrough clip
- runtime metrics
- scene issues report
- defect log
- manifest/asset fingerprints

This playbook is the source of truth for baseline capture output naming and locations.

## Standard Output Layout

Use one run directory per capture:

```text
reports/client-polish/baseline/<run_id>/
  baseline-report.md
  command-log.txt
  commit.txt
  scene-fingerprint.sha1
  asset-fingerprints.sha1
  runtime-defects.md
  scene-issues.md
  screenshots/
  walkthrough/
```

`<run_id>` format:
- UTC timestamp: `YYYYMMDDTHHMMSSZ` (example: `20260215T124500Z`)

## Environment Flags

- `VITE_OFFLINE_MOCK_WORLD=1`: force offline mock runtime path
- `VITE_WORLD_WS_AUTO_CONNECT=0`: disable websocket auto-connect
- `VITE_SCENE_ID=cozy_office_v0`: pin scene id during capture

Use all three flags for baseline runs unless a bead explicitly requires online mode.

## Capture Procedure

1. Set capture variables and create directories.

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="reports/client-polish/baseline/${RUN_ID}"
mkdir -p "${OUT_DIR}/screenshots" "${OUT_DIR}/walkthrough"
```

2. Record exact repo revision and command history seed.

```bash
git rev-parse HEAD > "${OUT_DIR}/commit.txt"
```

3. Capture scene + GLB fingerprints for reproducibility.

```bash
shasum assets/scenes/cozy_office_v0.scene.json > "${OUT_DIR}/scene-fingerprint.sha1"
find assets/glb -type f -name '*.glb' -print0 | sort -z | xargs -0 shasum > "${OUT_DIR}/asset-fingerprints.sha1"
```

4. Run deterministic preflight validations and log commands/results.

```bash
{
  echo "== $(date -u +%FT%TZ) baseline validation =="
  echo "VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck"
  VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck
  echo "VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build"
  VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build
  echo "tools/qa/run-visual-qa.sh --mode offline --validate"
  tools/qa/run-visual-qa.sh --mode offline --validate
  echo "node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report ${OUT_DIR}/scene-issues.md"
  node tools/glb-preflight.mjs \
    --scene assets/scenes/cozy_office_v0.scene.json \
    --asset-root assets/glb \
    --report "${OUT_DIR}/scene-issues.md"
} | tee "${OUT_DIR}/command-log.txt"
```

5. Launch app in baseline runtime mode and capture media.

```bash
VITE_OFFLINE_MOCK_WORLD=1 \
VITE_WORLD_WS_AUTO_CONNECT=0 \
VITE_SCENE_ID=cozy_office_v0 \
npm --prefix apps/client-web run dev
```

While app is running:
- take baseline screenshots for VQA scenarios (`VQA-01`..`VQA-06`) into `${OUT_DIR}/screenshots/`
- record one short walkthrough clip into `${OUT_DIR}/walkthrough/`
- note console warnings/errors into `${OUT_DIR}/runtime-defects.md`
- record Debug HUD values:
  - `fps`
  - `frameP95Ms`
  - `hotspotPercent`
  - `drawCalls`
  - `triangles`

6. Materialize report from template.

```bash
cp reports/client-polish-evidence.template.md "${OUT_DIR}/baseline-report.md"
```

Fill in all `TODO` sections in `baseline-report.md`.

## Before/After Comparison Protocol

To compare baseline vs later polish run:
1. Keep original baseline folder unchanged.
2. Create a new `<run_id>` folder with this same procedure.
3. In the new report, set:
   - `Baseline Run ID`
   - `Comparison Run ID`
4. Complete delta fields in metric and defect tables.

## Scene-Only Capture Variant (`bd-1mob`)

Use this when a bead needs screenshot evidence of the 3D scene without overlay/panel chrome.

Script:
- `tools/qa/capture-baseline-visuals.mjs --scene-only`

Behavior:
- uses deterministic `agent-browser` steps (no Playwright dependency for this mode)
- keeps normal interaction sequencing, but hides `.overlay-root` just before each screenshot
- writes outputs to the same baseline layout (`screenshots/`, `runtime-defects.md`, `capture-summary.json`, `command-log.txt`)

Example:

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="reports/client-polish/qa/scene-only-${RUN_ID}"

VITE_OFFLINE_MOCK_WORLD=1 \
VITE_WORLD_WS_AUTO_CONNECT=0 \
VITE_SCENE_ID=cozy_office_v0 \
npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4190

node tools/qa/capture-baseline-visuals.mjs \
  --base-url http://127.0.0.1:4190 \
  --out-dir "${OUT_DIR}" \
  --scene-only
```

## Exit Checklist

- `baseline-report.md` completed with no placeholder TODOs
- screenshots exist for all required scenarios
- walkthrough clip exists
- `scene-issues.md` generated
- `runtime-defects.md` captured
- fingerprints recorded (`scene-fingerprint.sha1`, `asset-fingerprints.sha1`)
