import type { SceneObjectSpec, ScenePoi } from "../loader";

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildPoiHighlightNodesById(
  pois: ScenePoi[],
  objects: SceneObjectSpec[]
): Record<string, string[]> {
  const byPoi: Record<string, string[]> = {};

  for (const poi of pois) {
    byPoi[poi.poi_id] = dedupe(Array.isArray(poi.highlight_nodes) ? poi.highlight_nodes : []);
  }

  for (const object of objects) {
    if (!object.poi_id) {
      continue;
    }
    const existing = byPoi[object.poi_id] ?? [];
    const fromObject = Array.isArray(object.highlight_nodes) ? object.highlight_nodes : [];
    byPoi[object.poi_id] = dedupe([...existing, ...fromObject]);
  }

  return byPoi;
}
