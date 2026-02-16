# Client Polish Evidence Report

## Run Metadata

- Bead: `bd-2go`
- Baseline Run ID: `20260215T131415Z`
- Comparison Run ID: `N/A` (baseline-only)
- Date (UTC): `2026-02-15`
- Operator: `HazyEagle`
- Branch: `main`
- Commit: `a03a78db9f528615f12948eca9321dab2ca7b8ad`
- Runtime mode: `offline`
- Scene ID: `cozy_office_v0`

## Output Artifact Paths

- Command log: `reports/client-polish/baseline/20260215T131415Z/command-log.txt`
- Scene issues report: `reports/client-polish/baseline/20260215T131415Z/scene-issues.md`
- Runtime defect log: `reports/client-polish/baseline/20260215T131415Z/runtime-defects.md`
- Scene fingerprint: `reports/client-polish/baseline/20260215T131415Z/scene-fingerprint.sha1`
- Asset fingerprints: `reports/client-polish/baseline/20260215T131415Z/asset-fingerprints.sha1`
- Screenshots root: `reports/client-polish/baseline/20260215T131415Z/screenshots/`
- Walkthrough clip: `reports/client-polish/baseline/20260215T131415Z/walkthrough/baseline-walkthrough.webm`
- Debug HUD capture: `reports/client-polish/baseline/20260215T131415Z/debug-hud.txt`

## Command Evidence

| Command | Result | Notes |
|---|---|---|
| `VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck` | `pass` | Logged in `command-log.txt` |
| `VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build` | `pass` | Bundle-size warning only; build completed |
| `tools/qa/run-visual-qa.sh --mode offline --validate` | `pass` | Script + checklist order emitted successfully |
| `node tools/glb-preflight.mjs ... --report <scene-issues.md>` | `pass` | `Errors: 0`, `Warnings: 4` |
| `agent-browser --cdp 9223 ...` capture flow | `pass` | VQA screenshot set + walkthrough clip generated |

## Visual Scenario Coverage

| Scenario | Baseline Evidence | Current Evidence | Delta Notes |
|---|---|---|---|
| `VQA-01` hitbox target resolution | `screenshots/VQA-01-hitbox-target-resolution.png` | `N/A` | Baseline-only capture |
| `VQA-02` camera focus + panel anchoring | `screenshots/VQA-02-camera-focus-panel-anchor.png` | `N/A` | Baseline-only capture |
| `VQA-03` highlight lifecycle | `screenshots/VQA-03-highlight-lifecycle.png` | `N/A` | Baseline-only capture |
| `VQA-04` event feed linkage | `screenshots/VQA-04-event-feed-linkage.png` | `N/A` | Baseline-only capture |
| `VQA-05` navigation + debug overlays | `screenshots/VQA-05-navigation-debug-overlays.png` | `N/A` | Baseline-only capture |
| `VQA-06` agent inspector state/task/blockers | `screenshots/VQA-06-agent-inspector-state.png` | `N/A` | Baseline-only capture |

## Runtime Metrics Comparison

Captured from `debug-hud.txt` during baseline run (agent-browser/CDP). Values are environment-dependent and should be compared against later runs captured with the same method.

| Metric | Baseline | Current | Delta | Target/Threshold |
|---|---|---|---|---|
| FPS | `5.6` | `N/A` | `N/A` | `higher is better` |
| frame p95 (ms) | `299.80` | `N/A` | `N/A` | `lower is better` |
| hotspot rate (%) | `57.0` | `N/A` | `N/A` | `lower is better` |
| draw calls | `87` | `N/A` | `N/A` | `lower/steady` |
| triangles | `489334` | `N/A` | `N/A` | `within budget` |

## Scene Issues and Defects

### Scene Issues Summary

- Blocking errors: `0`
- Warnings: `4`
- Report file: `reports/client-polish/baseline/20260215T131415Z/scene-issues.md`

### Runtime Defect Log

| ID | Severity | Baseline | Current | Status | Notes |
|---|---|---|---|---|---|
| `RDEF-001` | `low` | `absent` | `N/A` | `known` | No runtime page/console errors after buffer clear in final CDP capture pass. |

## Comparison Outcome

- Overall outcome: `baseline-only`
- Regressions requiring follow-up beads: `none identified in baseline-only run`
- Follow-up bead links: `bd-ejin` (first-time-user affordance walkthrough)
