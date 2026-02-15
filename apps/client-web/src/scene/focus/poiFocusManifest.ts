import cozyOfficeManifest from "../highlight/cozy_office_v0.scene.json";

type Vec3 = [number, number, number];
const ZERO_VEC3: Vec3 = [0, 0, 0];
const DEFAULT_CAMERA_OFFSET: Vec3 = [0, 1.2, 1.8];

interface PoiManifestNode {
  poi_id?: unknown;
  nav_anchors?: unknown;
  ui_anchor?: unknown;
  camera_framing?: unknown;
}

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

function toPoiFocusConfig(node: PoiManifestNode): PoiFocusConfig | null {
  if (typeof node.poi_id !== "string" || node.poi_id.length === 0) {
    return null;
  }

  const navAnchorPos: Vec3 =
    Array.isArray(node.nav_anchors) && node.nav_anchors.length > 0
      ? asVec3((node.nav_anchors[0] as { pos?: unknown })?.pos, ZERO_VEC3)
      : ZERO_VEC3;

  const uiAnchor = node.ui_anchor && typeof node.ui_anchor === "object"
    ? (node.ui_anchor as { pos?: unknown })
    : null;
  const cameraFraming = node.camera_framing && typeof node.camera_framing === "object"
    ? (node.camera_framing as { offset?: unknown; zoom?: unknown })
    : null;

  const panelAnchor = asVec3(uiAnchor?.pos, navAnchorPos);

  return {
    poiId: node.poi_id,
    focusPoint: navAnchorPos,
    panelAnchor,
    cameraOffset: asVec3(cameraFraming?.offset, DEFAULT_CAMERA_OFFSET),
    zoomMultiplier:
      typeof cameraFraming?.zoom === "number" && Number.isFinite(cameraFraming.zoom)
        ? cameraFraming.zoom
        : 1
  };
}

export const poiFocusConfigById: Record<string, PoiFocusConfig> = (() => {
  const source = cozyOfficeManifest as { pois?: PoiManifestNode[] };
  const entries = (source.pois ?? [])
    .map((poi) => toPoiFocusConfig(poi))
    .filter((poi): poi is PoiFocusConfig => Boolean(poi))
    .map((poi) => [poi.poiId, poi] as const);

  return Object.fromEntries(entries);
})();
