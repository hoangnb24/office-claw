# `bd-derz` Demo Profile Debug Default Tuning

## Summary

Adjusted UI debug defaults to preserve engineer tooling while reducing first-run/demo noise.

## Changes

1. `apps/client-web/src/state/uiStore.ts`
   - separated "debug profile available" from "debug defaults enabled".
   - new default behavior:
     - `debugHudEnabled=false` unless `VITE_DEBUG_HUD=1` or `VITE_NAV_DEBUG=1`
     - nav overlays (`path`, `blocked cells`, `anchor issues`) default off unless `VITE_NAV_DEBUG=1`
   - debug controls remain discoverable in dev/debug-capable profiles.

2. `docs/client-debug-hud.md`
   - documented low-noise default semantics and explicit env overrides.

3. `docs/client-local-navgrid.md`
   - documented that demo/dev defaults keep HUD/overlay noise off until enabled.

## Validation

1. `npm --prefix apps/client-web run typecheck` ⛔ blocked by unrelated concurrent changes:
   - `apps/client-web/src/overlay/OverlayRoot.tsx` unused symbol errors
   - `apps/client-web/src/scene/render/instancedAssembly.ts` type errors
2. `npm --prefix apps/client-web run build` ⛔ blocked by same unrelated concurrent errors
3. `npm --prefix contracts run validate` ✅
4. Scope check:
   - `apps/client-web/src/state/uiStore.ts` compiles structurally and only changes initial debug default values.
   - No focus/highlight selection logic was modified.

## Outcome

- Demo baseline is less visually noisy by default.
- Focus/highlight behavior remains available and debug tooling can be turned on quickly via HUD toggle or env flags.
