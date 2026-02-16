# Runtime Metrics Baseline (`bd-xlo`)

Generated at: `2026-02-15T13:10:30Z`  
Agent: `MagentaTower`  
Capture mode: offline baseline profile with `agent-browser`

## Environment

- App launch command:
  - `VITE_OFFLINE_MOCK_WORLD=1 VITE_WORLD_WS_AUTO_CONNECT=0 VITE_SCENE_ID=cozy_office_v0 npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4173`
- URL used for capture: `http://127.0.0.1:4173/`
- Debug HUD fields captured:
  - `FPS`
  - `Frame p95 (ms)`
  - `Frame hotspots (>20ms)` percent
  - `Draw calls`
  - `Triangles`

## Reproducible Scenario Procedure

1. Launch app with the environment flags above.
2. Open the page with `agent-browser` and wait for warm-up.
3. For each scenario, capture 3 HUD samples spaced by 3 seconds:
   - `agent-browser eval "<metrics-extraction-js>"`
4. Interaction-heavy sequence (deterministic):
   - `Alt+1` .. `Alt+7` (panel toggles)
   - `Alt+Shift+D` (scripted demo flow hotkey), wait 5s
   - `Alt+Shift+D`, wait 5s
   - `Alt+Shift+D`, wait 5s

## Raw Captures

### Scenario A: Idle (post-warm-up, no active interactions)

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:07:02.501Z` | 74.9 | 14.7 | 2.8 | 124 | 6,046 |
| `2026-02-15T13:07:05.839Z` | 73.0 | 15.8 | 3.0 | 124 | 6,046 |
| `2026-02-15T13:07:09.171Z` | 68.5 | 17.6 | 3.0 | 124 | 6,046 |

### Scenario B: Interaction-heavy (panel toggles + scripted demo flow hotkey)

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:09:38.021Z` | 13.6 | 107.1 | 97.9 | 122 | 489,006 |
| `2026-02-15T13:09:41.377Z` | 14.3 | 85.4 | 98.0 | 122 | 489,006 |
| `2026-02-15T13:09:44.761Z` | 15.0 | 79.9 | 98.2 | 122 | 489,006 |

## Scenario Averages

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | 72.1 | 16.0 | 2.9 | 124 | 6,046 |
| Interaction-heavy | 14.3 | 90.8 | 98.0 | 122 | 489,006 |

## Notes

- The interaction-heavy sequence is intentionally stress-oriented and deterministic (same hotkey/panel sequence per run).
- Draw calls stayed nearly flat while triangle count rose substantially during the interaction-heavy sequence, indicating geometry pressure rather than CPU-side dispatch churn as the dominant bottleneck in that path.
