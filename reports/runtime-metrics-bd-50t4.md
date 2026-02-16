# Runtime Metrics Delta Report (`bd-50t4`)

Generated at: `2026-02-15T13:39:00Z`  
Agent: `RainyDune`

## Objective

Measure draw-call and frame-time deltas before vs after the instancing rollout work (`bd-2sv8`, `bd-3cof`) using the baseline-aligned scenario methodology.

## Baseline Reference

Source report: `reports/runtime-metrics-baseline.md` (`bd-xlo`)

Baseline averages used for comparison:

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | 72.1 | 16.0 | 2.9 | 124 | 6,046 |
| Interaction-heavy | 14.3 | 90.8 | 98.0 | 122 | 489,006 |

## Current Capture Environment

- Launch command:
  - `VITE_OFFLINE_MOCK_WORLD=1 VITE_WORLD_WS_AUTO_CONNECT=0 VITE_SCENE_ID=cozy_office_v0 VITE_DEBUG_HUD=1 npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4175`
- Browser runner:
  - `agent-browser` (session `bd50t4`)
- URL:
  - `http://127.0.0.1:4175/`

## Scenario Procedure

1. Open app and warm for ~7s.
2. Capture 3 idle samples spaced by 3s.
3. Run deterministic interaction sequence:
   - `Alt+1`..`Alt+7`
   - `Alt+Shift+D` x3 with 5s between presses
4. Capture 3 interaction-heavy samples spaced by 3s.

## Raw Current Samples

### Idle

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:37:22.549Z` | 4.0 | 570.5 | 93.0 | 14 | 487,710 |
| `2026-02-15T13:37:25.874Z` | 3.5 | 698.2 | 94.0 | 14 | 487,710 |
| `2026-02-15T13:37:29.160Z` | 3.3 | 783.2 | 94.7 | 14 | 487,710 |

### Interaction-heavy

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:38:10.314Z` | 2.6 | 698.2 | 98.0 | 14 | 487,710 |
| `2026-02-15T13:38:13.781Z` | 2.6 | 699.7 | 98.1 | 14 | 487,710 |
| `2026-02-15T13:38:17.236Z` | 2.6 | 699.7 | 98.2 | 14 | 487,710 |

## Current Averages

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | 3.6 | 684.0 | 93.9 | 14 | 487,710 |
| Interaction-heavy | 2.6 | 699.2 | 98.1 | 14 | 487,710 |

## Delta vs Baseline (Current - Baseline)

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | -68.5 (-95.0%) | +668.0 (+4174.8%) | +91.0 (+3137.9%) | -110 (-88.7%) | +481,664 (+7966.7%) |
| Interaction-heavy | -11.7 (-81.8%) | +608.4 (+670.0%) | +0.1 (+0.1%) | -108 (-88.5%) | -1,296 (-0.3%) |

## Caveats and Interpretation

1. Instancing metadata is currently absent in the scene manifest:
   - `assets/scenes/cozy_office_v0.scene.json`: `instance_group` object count = `0`
   - `apps/client-web/public/scenes/cozy_office_v0.scene.json`: `instance_group` object count = `0`
2. Because there are zero `instance_group` candidates, the new instanced assembly path is effectively dormant for this scene; measured deltas cannot be attributed to instancing rollout impact yet.
3. Draw-call counts are much lower than the baseline report while frame-time is substantially worse in this run, indicating broader runtime/profile differences versus the baseline capture context.
4. This report is therefore a valid measurement snapshot with explicit caveats, but not a clean A/B attribution for instancing efficacy.

## Artifacts

- Raw capture JSON: `reports/perf/bd-50t4-metrics.json`
- Baseline comparison source: `reports/runtime-metrics-baseline.md`
