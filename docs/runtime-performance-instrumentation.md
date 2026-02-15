# Runtime Performance Instrumentation Baseline

Linked bead: `bd-2k5`

Follow-up optimization: `bd-2kr`

## Delivered instrumentation

### Client runtime telemetry

- `apps/client-web/src/scene/debug/RuntimeTelemetryProbe.tsx`
  - publishes frame telemetry every ~250ms:
    - `fps`, frame avg/p95, hotspot rate (`>20ms` frames)
    - render stats (`drawCalls`, `triangles`, `lines`, `points`)
  - computes threshold-based perf alerts with severity levels:
    - `healthy | warning | critical`
    - alert keys such as `fps_low`, `frame_p95_high`, `draw_calls_high`, `triangles_high`
- `apps/client-web/src/state/worldStore.ts`
  - extends `runtimePerf` with:
    - `alertLevel`
    - `alerts[]`
- `apps/client-web/src/overlay/OverlayRoot.tsx`
  - Debug HUD now shows current perf alert level and active alert keys.

### Server runtime telemetry

- `apps/server-world/src/simulation.mjs`
  - adds rolling tick timing metrics:
    - `tick_timing_ms.{samples,last,avg,p95,max,last_tick_duration_ms}`
  - adds rolling queue latency metrics for command/event queues:
    - `queue_latency_ms.commands.{samples,last,avg,p95,max}`
    - `queue_latency_ms.events.{samples,last,avg,p95,max}`
- `apps/server-world/src/worldServer.mjs`
  - observes simulation perf signals and emits threshold alerts:
    - `slow_tick_ms`
    - `queue_latency_ms`
  - default observability thresholds now include perf thresholds.
  - `/health` exposes simulation perf telemetry via `simulation.*`.

## Threshold behavior

- Client: perf severity is derived from FPS/frame-time/hotspot/render-count thresholds.
- Server: threshold alerts are integrated into existing observability alert pipeline and error dashboard.

## Validation

- `npm --prefix apps/server-world test`
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
- `npm --prefix contracts run validate`

## Optimization follow-up (`bd-2kr`)

- `apps/client-web/src/App.tsx`
  - enforces renderer budget defaults:
    - `dpr={[1, 1.5]}`
    - `gl.antialias=false`
    - `gl.powerPreference="high-performance"`
    - `shadows` enabled with scene-level budgeting
- `apps/client-web/src/scene/assets/sceneAssetCatalog.ts`
  - per-asset shadow budgets (`shadowCasters`, `shadowReceivers`) added
- `apps/client-web/src/scene/assets/useSceneAssets.ts`
  - applies the per-asset shadow budgets during asset load
- `apps/client-web/src/scene/OfficeScene.tsx`
  - fixed lighting budget (ambient + hemisphere + single key directional light)
  - selective instancing for repeated POI highlight markers (`InstancedMesh` when count > 1)
