# Client HighlightManager (`bd-3sk`)

## Scope
- Highlight POIs by `poi_id` using manifest-provided `highlight_nodes`.
- Glow participant agents during focus/selection.
- Clear/reset highlights deterministically on focus changes.

## Implementation
- `apps/client-web/src/scene/highlight/cozy_office_v0.scene.json`
  - scene manifest snapshot used for POI highlight node lookup.
- `apps/client-web/src/scene/highlight/poiHighlightManifest.ts`
  - derives `poiHighlightNodesById` from manifest `pois[].highlight_nodes` and object-level `highlight_nodes` by `poi_id`.
- `apps/client-web/src/scene/highlight/HighlightManager.ts`
  - applies/removes material-level glow overlays for POI + participant focus.
  - tracks active focus key and restores original materials when focus changes.
- `apps/client-web/src/scene/highlight/useHighlightManager.ts`
  - resolves active focus inputs from `interactionStore` + `uiStore`.
  - applies highlight manager updates and returns current focus state to scene renderers.
- `apps/client-web/src/scene/OfficeScene.tsx`
  - wires highlight hook.
  - tags interaction targets with `poiId` where applicable.
  - renders POI marker indicators and participant agent glow states.

## Focus semantics
- POI priority:
  1. `uiStore.focusedPoiId`
  2. selected interaction target (`selectedType === "poi"`)
  3. hovered interaction target (`hoveredType === "poi"`)
- Participant agents:
  - union of focused/selected/hovered agent ids.
- Any change in resolved focus key clears prior highlights before applying next highlights.

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
