# bd-3qzg Lighting/Readability Polish

Generated: 2026-02-16T02:12:55Z

## Goal

Address KI-R01 from `bd-95kn` by improving scene-first readability in default Cozy Office framing.

## Implementation

Updated `apps/client-web/src/scene/OfficeScene.tsx` (`LIGHTING_BUDGET`):

1. Lifted global readability:
   - brighter background/fog/ground palette
   - higher ambient + hemisphere intensity
2. Increased key/fill contribution for object legibility:
   - key intensity `0.86 -> 1.32`
   - fill intensity `0.20 -> 0.44`
3. Reduced haze washout by widening fog range:
   - added `fogNear: 14`, `fogFar: 46`
   - fog now uses budget-driven near/far values

## Evidence (before vs after)

Capture directory:
- `reports/client-polish/sprint-a-lighting/20260216T021207Z`

Images:
1. Before:
   - `reports/client-polish/sprint-a-lighting/20260216T021207Z/before-scene-no-ui.png`
2. After (final):
   - `reports/client-polish/sprint-a-lighting/20260216T021207Z/after-v2-scene-no-ui.png`

Outcome:
- Agent silhouettes and center prop cluster read more clearly at default camera framing.
- Scene remains within the cozy palette direction while reducing near-black visual collapse.

## Validation

1. `npm --prefix apps/client-web run typecheck` passed.
2. `npm --prefix apps/client-web run build` passed.
3. `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight.bd-3qzg.md` passed.
