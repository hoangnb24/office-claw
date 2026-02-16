# Client Polish Evidence Report Template

Use this file for both baseline and post-polish comparison runs.

## Run Metadata

- Bead: `bd-1gr` (or follow-up bead id)
- Baseline Run ID: `TODO`
- Comparison Run ID: `TODO` (`N/A` for first baseline-only capture)
- Date (UTC): `TODO`
- Operator: `TODO`
- Branch: `TODO`
- Commit: `TODO`
- Runtime mode: `offline|online`
- Scene ID: `cozy_office_v0` (or `TODO`)

## Output Artifact Paths

- Command log: `TODO`
- Scene issues report: `TODO`
- Runtime defect log: `TODO`
- Scene fingerprint: `TODO`
- Asset fingerprints: `TODO`
- Screenshots root: `TODO`
- Walkthrough clip: `TODO`

## Command Evidence

| Command | Result | Notes |
|---|---|---|
| `VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck` | `pass|fail` | `TODO` |
| `VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build` | `pass|fail` | `TODO` |
| `tools/qa/run-visual-qa.sh --mode offline --validate` | `pass|fail` | `TODO` |
| `node tools/glb-preflight.mjs ... --report <scene-issues.md>` | `pass|fail` | `TODO` |

## Visual Scenario Coverage

| Scenario | Baseline Evidence | Current Evidence | Delta Notes |
|---|---|---|---|
| `VQA-01` hitbox target resolution | `TODO` | `TODO` | `TODO` |
| `VQA-02` camera focus + panel anchoring | `TODO` | `TODO` | `TODO` |
| `VQA-03` highlight lifecycle | `TODO` | `TODO` | `TODO` |
| `VQA-04` event feed linkage | `TODO` | `TODO` | `TODO` |
| `VQA-05` navigation + debug overlays | `TODO` | `TODO` | `TODO` |
| `VQA-06` agent inspector state/task/blockers | `TODO` | `TODO` | `TODO` |

## Runtime Metrics Comparison

| Metric | Baseline | Current | Delta | Target/Threshold |
|---|---|---|---|---|
| FPS | `TODO` | `TODO` | `TODO` | `higher is better` |
| frame p95 (ms) | `TODO` | `TODO` | `TODO` | `lower is better` |
| hotspot rate (%) | `TODO` | `TODO` | `TODO` | `lower is better` |
| draw calls | `TODO` | `TODO` | `TODO` | `lower/steady` |
| triangles | `TODO` | `TODO` | `TODO` | `within budget` |

## Scene Issues and Defects

### Scene Issues Summary

- Blocking errors: `TODO`
- Warnings: `TODO`
- Report file: `TODO`

### Runtime Defect Log

| ID | Severity | Baseline | Current | Status | Notes |
|---|---|---|---|---|---|
| `TODO` | `high|medium|low` | `present|absent` | `present|absent` | `open|fixed|known` | `TODO` |

## Comparison Outcome

- Overall outcome: `improved|regressed|mixed|baseline-only`
- Regressions requiring follow-up beads: `TODO`
- Follow-up bead links: `TODO`

