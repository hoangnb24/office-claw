# Client AgentRenderer

Related bead: `bd-y9e`

## What was added
- `apps/client-web/src/scene/agents/AgentRenderer.tsx`
- `apps/client-web/src/scene/agents/index.ts`
- `apps/client-web/src/scene/OfficeScene.tsx` integration

## Clip contract
Required clips:
- `Idle`
- `Walk`
- `Work_Typing`
- `Think`

Optional clip:
- `Carry`

## State-to-clip mapping
- `idle` -> `Idle`
- `walking` -> `Walk`
- `working` -> `Work_Typing`
- `meeting` -> `Think`
- `blocked` -> `Think`
- `isCarrying=true` overrides with `Carry` when available

## Fallback behavior
- If target clip is missing, renderer falls back to `Idle` (or first available clip).
- If no clips are available, model renders static and warning is emitted once.
- If no model is supplied, renderer uses procedural placeholder meshes by state color.
- If required clips are incomplete, a small amber indicator appears above the model.

## Temporary alias support (Meshy compatibility)
- Alias resolution is supported for non-canonical clip names while assets are being normalized.
- Current aliases:
  - `Idle`: `Idle_3`, `Standing`
  - `Walk`: `Walking`, `Running`
  - `Work_Typing`: `Sitting_Answering_Questions`, `Sitting`
  - `Think`: `Sitting_Clap`, `Standing`, `No`, `Yes`
  - `Carry`: `Carry_Heavy_Object_Walk`
- Canonical clip names are still the source-of-truth for final asset packs.

## Notes
- Animation playback is driven by `AnimationMixer` with cross-fade transitions.
- Models are cloned per instance to avoid shared skeleton/action state collisions.
