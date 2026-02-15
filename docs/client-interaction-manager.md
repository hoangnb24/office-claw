# Client InteractionManager

Related bead: `bd-70n`

## Delivered
- `apps/client-web/src/scene/interaction/interactionTypes.ts`
- `apps/client-web/src/scene/interaction/InteractionManager.ts`
- `apps/client-web/src/scene/interaction/useInteractionManager.ts`
- `apps/client-web/src/scene/interaction/index.ts`
- `apps/client-web/src/state/interactionStore.ts` updates
- `apps/client-web/src/scene/OfficeScene.tsx` wiring

## Capabilities
- Raycast-based hover detection with bounded cadence (`hoverIntervalMs`, default 60ms).
- Click target resolution across interaction target categories:
  - `poi`
  - `agent`
  - `artifact`
  - `object`
- Dispatch contract into UI/command layer adapters:
  - hover updates
  - selected target updates
  - command intent enqueueing

## Dispatch contract shape
- Hover updates -> `setHovered(id, type)` and pointer world position.
- Click updates -> `setSelected(id, type)` and pointer world position.
- Command intents -> `queueCommandIntent({ name, sourceId, sourceType, payload })`.

## Failure and edge behavior
- Raycast hits with no `interactionTarget` metadata are ignored.
- Hover sampling is bounded to avoid per-frame state churn.
- `clearHover()` resets stale hover state on pointer-out.
- If a target has no explicit command mapping, fallback command names are derived by target type.

## Scene wiring notes
- Interactive scene assets and agent wrappers are tagged via:
  - `userData.interactionTarget = { id, type, commandName?, commandPayload? }`
- `OfficeScene` root group forwards pointer events into `useInteractionManager`.

## Validation run
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
