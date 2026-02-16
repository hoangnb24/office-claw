# Client Debug HUD

`bd-1eo` adds a dev-only debug HUD for runtime performance and navigation diagnostics.
`bd-2nhs` gates runtime telemetry/verbose logs behind explicit debug-profile flags.

## Scope

- live render metrics in overlay (`fps`, frame average/p95, draw calls, triangles, lines, points)
- frame hotspot counters (`>20ms` frames) for quick frame-time triage
- asset startup timing counters:
  - total startup duration
  - slowest asset id + duration
- runtime toggles for navigation overlays:
  - path node markers
  - blocked nav cells
  - anchor validation issue markers

## Runtime behavior

- HUD controls are available in debug-capable profiles:
  - `import.meta.env.DEV`
  - `VITE_DEBUG_HUD=1`
  - `VITE_NAV_DEBUG=1`
- low-noise defaults:
  - `debugHudEnabled=false` unless `VITE_DEBUG_HUD=1` or `VITE_NAV_DEBUG=1`
  - nav overlays (`path`, `blocked cells`, `anchor issues`) default off unless `VITE_NAV_DEBUG=1`
- debug overlays only render when HUD is enabled and corresponding toggles are on.
- telemetry probe samples per-frame and publishes a smoothed snapshot to `worldStore.runtimePerf` every `~250ms`.
- runtime perf severity + alert tags are derived from threshold checks (FPS/frame p95/hotspot/draw-call/triangle pressure).

## Debug-profile telemetry gating (`bd-2nhs`)

- Runtime telemetry probe mount is now gated by explicit debug flags only:
  - `VITE_DEBUG_HUD=1`
  - `VITE_NAV_DEBUG=1`
- In non-debug profiles, `RuntimeTelemetryProbe` is not mounted and no per-frame perf sampling loop runs.
- Asset telemetry logging behavior:
  - `load_error` remains emitted to console as critical signal.
  - verbose asset telemetry (`load_success`, `cache_hit`, and generic telemetry debug lines) is emitted only when debug-profile flags are active.

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
