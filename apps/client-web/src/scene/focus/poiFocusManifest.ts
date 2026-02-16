import type { ScenePoi } from "../loader";

type Vec3 = [number, number, number];
const ZERO_VEC3: Vec3 = [0, 0, 0];
const DEFAULT_CAMERA_OFFSET: Vec3 = [0, 1.2, 1.8];

export interface PoiFocusConfig {
  poiId: string;
  focusPoint: Vec3;
  panelAnchor: Vec3;
  cameraOffset: Vec3;
  zoomMultiplier: number;
}

function asVec3(value: unknown, fallback: Vec3): Vec3 {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return [value[0], value[1], value[2]];
  }
  return fallback;
}

export function toPoiFocusConfig(poi: ScenePoi): PoiFocusConfig {
  const navAnchorPos: Vec3 =
    Array.isArray(poi.nav_anchors) && poi.nav_anchors.length > 0
      ? asVec3(poi.nav_anchors[0]?.pos, ZERO_VEC3)
      : ZERO_VEC3;

  const uiAnchorRaw = (poi as { ui_anchor?: unknown }).ui_anchor;
  const uiAnchor = uiAnchorRaw && typeof uiAnchorRaw === "object"
    ? (uiAnchorRaw as { pos?: unknown })
    : null;
  const cameraFramingRaw = (poi as { camera_framing?: unknown }).camera_framing;
  const cameraFraming = cameraFramingRaw && typeof cameraFramingRaw === "object"
    ? (cameraFramingRaw as { offset?: unknown; zoom?: unknown })
    : null;

  const panelAnchor = asVec3(uiAnchor?.pos, navAnchorPos);

  return {
    poiId: poi.poi_id,
    focusPoint: navAnchorPos,
    panelAnchor,
    cameraOffset: asVec3(cameraFraming?.offset, DEFAULT_CAMERA_OFFSET),
    zoomMultiplier:
      typeof cameraFraming?.zoom === "number" && Number.isFinite(cameraFraming.zoom)
        ? cameraFraming.zoom
        : 1
  };
}

export function buildPoiFocusConfigById(pois: ScenePoi[]): Record<string, PoiFocusConfig> {
  return Object.fromEntries(pois.map((poi) => [poi.poi_id, toPoiFocusConfig(poi)] as const));
}
