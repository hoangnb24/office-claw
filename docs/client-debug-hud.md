# Client Debug HUD

`bd-1eo` adds a dev-only debug HUD for runtime performance and navigation diagnostics.

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

- enabled by default in dev profile:
  - `import.meta.env.DEV`
  - `VITE_DEBUG_HUD=1`
  - `VITE_NAV_DEBUG=1`
- debug overlays only render when HUD is enabled and corresponding toggles are on.
- telemetry probe samples per-frame and publishes a smoothed snapshot to `worldStore.runtimePerf` every `~250ms`.
- runtime perf severity + alert tags are derived from threshold checks (FPS/frame p95/hotspot/draw-call/triangle pressure).

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
