# Runtime Metrics Delta Report (`bd-lfez`)

Generated at: `2026-02-15T13:52:00Z`  
Agent: `PurpleOtter`

## Objective

Execute a baseline-aligned performance capture after phase-8 optimization lanes (`bd-295o`, `bd-qg4i`, `bd-2nhs`, `bd-2iss`) and publish before/after deltas with explicit tradeoffs.

## Baseline References

1. Phase-0 baseline: `reports/runtime-metrics-baseline.md`
2. Prior optimization snapshot: `reports/runtime-metrics-bd-50t4.md`
3. Raw prior samples: `reports/perf/bd-50t4-metrics.json`

## Capture Environment

- Launch command:
  - `VITE_OFFLINE_MOCK_WORLD=1 VITE_WORLD_WS_AUTO_CONNECT=0 VITE_SCENE_ID=cozy_office_v0 VITE_DEBUG_HUD=1 npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4173`
- Runtime URL (port auto-shifted):
  - `http://127.0.0.1:4174/`
- Browser runner:
  - `agent-browser` session `bdlfez` with software WebGL launch args (`--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`)

## Scenario Procedure

1. Open app and warm up.
2. Capture 3 idle samples with 3s spacing.
3. Run deterministic interaction sequence:
   - `Alt+1..Alt+7`
   - `Alt+Shift+D` x3 with 5s spacing
4. Capture 3 interaction-heavy samples with 3s spacing.

## Raw Samples

### Idle

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:50:31.184Z` | 4.6 | 376.6 | 98.9 | 11 | 292,678 |
| `2026-02-15T13:50:34.512Z` | 4.4 | 376.6 | 98.9 | 11 | 292,678 |
| `2026-02-15T13:50:37.993Z` | 4.3 | 318.2 | 99.0 | 11 | 292,678 |

### Interaction-heavy

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:51:14.076Z` | 3.5 | 537.6 | 99.4 | 19 | 488,034 |
| `2026-02-15T13:51:17.403Z` | 3.4 | 559.3 | 99.4 | 19 | 488,034 |
| `2026-02-15T13:51:20.785Z` | 3.3 | 562.5 | 99.4 | 19 | 488,034 |

## Current Averages

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | 4.4 | 357.1 | 98.9 | 11 | 292,678 |
| Interaction-heavy | 3.4 | 553.1 | 99.4 | 19 | 488,034 |

## Delta vs Phase-0 Baseline (`reports/runtime-metrics-baseline.md`)

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | -67.7 (-93.9%) | +341.1 (+2132.1%) | +96.0 (+3311.5%) | -113 (-91.1%) | +286,632 (+4740.9%) |
| Interaction-heavy | -10.9 (-76.2%) | +462.3 (+509.2%) | +1.4 (+1.4%) | -103 (-84.4%) | -972 (-0.2%) |

## Delta vs `bd-50t4` Snapshot

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | +0.8 (+23.1%) | -326.8 (-47.8%) | +5.0 (+5.4%) | -3 (-21.4%) | -195,032 (-40.0%) |
| Interaction-heavy | +0.8 (+30.8%) | -146.1 (-20.9%) | +1.3 (+1.3%) | +5 (+35.7%) | +324 (+0.1%) |

## Optimization-Pass Interpretation

1. Phase-8 passes materially improved the post-`bd-50t4` profile for idle and interaction frame-time/FPS, and reduced idle geometry pressure substantially.
2. Draw-call pressure remains much lower than Phase-0 baseline in both scenarios.
3. Interaction-heavy draw calls increased versus `bd-50t4` (14 -> 19), indicating a tradeoff between stricter runtime correctness paths and pure dispatch minimization.
4. Performance remains far from Phase-0 baseline in absolute frame-time/FPS terms under this headless software-WebGL capture mode.
5. Console evidence includes repeated WebGL `ReadPixels` stall warnings, which likely inflate frame-time under this capture method.

## Tradeoffs / Regressions

1. Major unresolved regression vs Phase-0 baseline: FPS and frame p95 remain severely degraded.
2. High hotspot rates persist (`~99%`) in both scenarios.
3. Interaction draw-call regression vs `bd-50t4` should be tracked into downstream QA sweeps (`bd-t9jf`, `bd-3uwh`) for user-impact verification.

## Artifacts

1. `reports/perf/bd-lfez-metrics.json`
2. `reports/client-polish/benchmarks/bd-lfez/idle-samples.jsonl`
3. `reports/client-polish/benchmarks/bd-lfez/interaction-samples.jsonl`
4. `reports/client-polish/benchmarks/bd-lfez/debug-hud.txt`
5. `reports/client-polish/benchmarks/bd-lfez/final-runtime.png`
6. `reports/client-polish/benchmarks/bd-lfez/console.log`
7. `reports/client-polish/benchmarks/bd-lfez/page-errors.log`
