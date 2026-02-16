# Runtime Telemetry + Verbose Log Gating (bd-2nhs)

Generated: 2026-02-15T13:30:00Z

## Objective

Ensure runtime telemetry probes and verbose diagnostics are active only in explicit debug profiles, while preserving critical failure visibility.

## Changes

### 1) Added explicit debug-profile helper

Updated `apps/client-web/src/config/runtimeProfile.ts`:
- added `isDebugDiagnosticsProfileEnabled(env?)`
- returns `true` only when either flag is explicitly active:
  - `VITE_DEBUG_HUD=1`
  - `VITE_NAV_DEBUG=1`

### 2) Gated `RuntimeTelemetryProbe` mount

Updated `apps/client-web/src/App.tsx`:
- compute `debugDiagnosticsProfile = isDebugDiagnosticsProfileEnabled()`
- mount `<RuntimeTelemetryProbe />` only when `debugDiagnosticsProfile` is `true`

Effect:
- non-debug/demo profile no longer runs per-frame telemetry sampling loop
- debug-profile keeps full runtime perf diagnostics

### 3) Gated verbose asset telemetry logs

Updated `apps/client-web/src/scene/assets/assetManagerSingleton.ts`:
- added debug-profile gate using `isDebugDiagnosticsProfileEnabled()`
- behavior:
  - `load_error` still logs to console (`console.error`) as critical signal
  - verbose telemetry logs (`load_success`, `cache_hit`, generic debug telemetry lines) only emit in debug profile

### 4) Documentation

Updated `docs/client-debug-hud.md` with `bd-2nhs` behavior:
- explicit flag-based telemetry gating
- no probe mount in non-debug profile
- critical-vs-verbose asset logging split

## Acceptance Mapping

1. Demo profile suppresses verbose telemetry noise: ✅
2. Debug profile preserves diagnostic depth: ✅

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix contracts run validate
```

Results:
- typecheck: pass
- build: pass
- contracts validate: pass
