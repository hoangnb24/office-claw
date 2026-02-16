# Instancing Benchmark Deltas (`bd-50t4`)

Generated at: `2026-02-15T13:39:10Z`  
Agent: `HazyEagle`  
Capture mode: offline baseline profile with `agent-browser` (CDP)

## Environment

- App launch command:
  - `VITE_OFFLINE_MOCK_WORLD=1 VITE_WORLD_WS_AUTO_CONNECT=0 VITE_SCENE_ID=cozy_office_v0 VITE_DEBUG_HUD=1 npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4173`
- Runtime port selected by Vite at run-time: `http://127.0.0.1:4174/` (`4173` was already in use)
- Browser path:
  - Chrome headless CDP on port `9223` with WebGL/swiftshader flags
- Baseline reference:
  - `reports/runtime-metrics-baseline.md`

## Scenario Procedure

1. Launch app with the env flags above.
2. Open URL via `agent-browser --cdp 9223 open http://127.0.0.1:4174/`.
3. Ensure Debug HUD is enabled.
4. Collect 3 samples (3s spacing) for each scenario:
   - Scenario A: Idle (post-warm-up, no additional interactions)
   - Scenario B: Interaction-heavy:
     - `Alt+1 .. Alt+7`
     - `Alt+Shift+D` x3 with 5s pauses

## Raw Captures

### Scenario A: Idle

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:37:25.959Z` | 2.9 | 524.9 | 93.1 | 14 | 487,710 |
| `2026-02-15T13:37:29.128Z` | 2.9 | 552.8 | 93.8 | 14 | 487,710 |
| `2026-02-15T13:37:32.294Z` | 2.9 | 524.9 | 94.4 | 14 | 487,710 |

### Scenario B: Interaction-heavy

| Timestamp (UTC) | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `2026-02-15T13:38:06.777Z` | 3.0 | 462.2 | 97.4 | 14 | 487,710 |
| `2026-02-15T13:38:09.943Z` | 3.0 | 462.2 | 97.6 | 14 | 487,710 |
| `2026-02-15T13:38:13.110Z` | 3.0 | 392.2 | 97.7 | 14 | 487,710 |

## Scenario Averages (Current Run)

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | 2.9 | 534.2 | 93.8 | 14 | 487,710 |
| Interaction-heavy | 3.0 | 438.9 | 97.6 | 14 | 487,710 |

## Delta vs Baseline (`reports/runtime-metrics-baseline.md`)

| Metric | Baseline Idle | Current Idle | Delta Idle | Baseline Interaction | Current Interaction | Delta Interaction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FPS | 72.1 | 2.9 | -69.2 | 14.3 | 3.0 | -11.3 |
| Frame p95 (ms) | 16.0 | 534.2 | +518.2 | 90.8 | 438.9 | +348.1 |
| Hotspot % | 2.9 | 93.8 | +90.9 | 98.0 | 97.6 | -0.4 |
| Draw calls | 124 | 14 | -110 | 122 | 14 | -108 |
| Triangles | 6,046 | 487,710 | +481,664 | 489,006 | 487,710 | -1,296 |

## Caveats

- Draw-call reduction is measurable and large in this run (`~14` vs baseline `~122-124`).
- Frame-time/FPS metrics are substantially worse than baseline and indicate an unstable/non-equivalent performance regime for this capture path.
- This run used a different occupied-port fallback (`4174`) and software WebGL headless path; treat FPS/frame-p95 comparisons as directional, not release-gate quality.
- Given the divergence, additional benchmark passes on a stabilized renderer/runtime lane are recommended before using this as final optimization proof.
