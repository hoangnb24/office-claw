import cozyOfficeManifest from "./cozy_office_v0.scene.json";

interface ManifestPoi {
  poi_id: string;
  highlight_nodes?: string[];
}

interface ManifestObject {
  poi_id?: string;
  highlight_nodes?: string[];
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export const poiHighlightNodesById: Record<string, string[]> = (() => {
  const manifest = cozyOfficeManifest as {
    pois?: ManifestPoi[];
    objects?: ManifestObject[];
  };

  const byPoi: Record<string, string[]> = {};

  for (const poi of manifest.pois ?? []) {
    if (!poi?.poi_id) {
      continue;
    }
    byPoi[poi.poi_id] = dedupe(toStringArray(poi.highlight_nodes));
  }

  for (const object of manifest.objects ?? []) {
    if (!object?.poi_id) {
      continue;
    }
    const existing = byPoi[object.poi_id] ?? [];
    const fromObject = toStringArray(object.highlight_nodes);
    byPoi[object.poi_id] = dedupe([...existing, ...fromObject]);
  }

  return byPoi;
})();
