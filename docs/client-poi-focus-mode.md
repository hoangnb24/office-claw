# Client POI Focus Mode (`bd-1yx`)

## Scope
- Camera focus transitions to POI framing targets.
- World-anchored panel positioning for focused POIs.
- Focus exit/restore behavior (camera + panel anchor reset).

## Implementation
- `apps/client-web/src/scene/focus/poiFocusManifest.ts`
  - derives per-POI focus metadata from scene manifest:
    - `focusPoint` (from `nav_anchors`)
    - `panelAnchor` (from `ui_anchor.pos`)
    - `cameraOffset` + `zoomMultiplier` (from `camera_framing`)
- `apps/client-web/src/scene/camera/IsometricCameraRig.tsx`
  - smooth lerp transitions between default and POI focus framing
  - stores pre-focus zoom and restores on exit
  - projects `panelAnchor` to screen space and writes anchor to UI store
- `apps/client-web/src/state/uiStore.ts`
  - adds `focusedPoiScreenAnchor` and setter
- `apps/client-web/src/overlay/OverlayRoot.tsx`
  - routes interaction command intents into focus state:
    - POI focus entry (`focus_poi`, panel-open commands)
    - agent focus entry (`open_agent_inspector`)
    - clear focus (`select_object`, `Escape`, explicit button)
  - anchors POI-linked panel card at projected screen position when focused
- `apps/client-web/src/styles.css`
  - adds anchored panel style (`panel-card-anchored`)

## Focus behavior
- Enter focus: command intent sets focused POI/agent and optional panel open.
- Active focus: camera frames POI and panel follows projected world anchor.
- Exit focus: clear focus restores camera default framing and removes panel anchor.

## Validation
- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
