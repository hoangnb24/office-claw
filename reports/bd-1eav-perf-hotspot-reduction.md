# bd-1eav - Cozy Office runtime perf hotspot reduction

## Scope
Address KI-R02 from `bd-95kn` by improving runtime responsiveness in the Cozy Office default scene.

## Code changes
1. `apps/client-web/src/App.tsx`
- Reduced renderer pixel density from adaptive high range to a fixed lower budget:
  - from `dpr={[1, 1.5]}` to `dpr={0.85}`.
- Disabled canvas shadow rendering pass (removed `shadows` prop from `<Canvas>`).

2. `apps/client-web/src/scene/OfficeScene.tsx`
- Reduced key light shadow map budget constant:
  - `keyShadowMapSize: 768` -> `512`.

3. `apps/client-web/src/scene/agents/AgentRenderer.tsx`
- Added model traversal helper to disable `castShadow`/`receiveShadow` on cloned agent meshes.
- Removed shadow casting from capsule/sphere fallback avatar meshes.

## Validation
- `npm --prefix apps/client-web run typecheck` ✅
- `npm --prefix apps/client-web run build` ✅
- `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight.bd-1eav.md` ✅

## Perf evidence
Baseline samples (5):
- `reports/client-polish/perf/bd-1eav/20260216T021601Z/hud-baseline-*.txt`

Post-change samples (5):
- `reports/client-polish/perf/bd-1eav/20260216T022433Z/hud-post-*.txt`
- scene screenshot: `reports/client-polish/perf/bd-1eav/20260216T022433Z/post-scene.png`

Capture method:
- local offline dev runtime (`VITE_OFFLINE_MOCK_WORLD=1`, `VITE_WORLD_WS_AUTO_CONNECT=0`, `VITE_SCENE_ID=cozy_office_v0`, `VITE_DEBUG_HUD=1`)
- deterministic `agent-browser` session commands

### Summary (5-sample averages)
| Metric | Baseline | Post | Delta |
|---|---:|---:|---:|
| FPS | 11.64 | 12.94 | +1.30 |
| Frame avg (ms) | 85.99 | 77.55 | -8.43 |
| Frame p95 (ms) | 88.50 | 80.68 | -7.82 |
| Frame hotspots >20ms (%) | 89.56 | 89.72 | +0.16 |
| Draw calls | 11 | 11 | 0 |
| Triangles | 802,038 | 802,038 | 0 |

## Outcome
- Primary KPI goals achieved for this bead: **FPS up** and **frame-time p95 down** with the new render budget.
- Hotspot percentage remained effectively flat in this environment, consistent with persistent high triangle load and static draw-call count.
- Residual structural perf work (geometry/material budget) remains a follow-up lane, but KI-R02 is materially improved for runtime responsiveness.
