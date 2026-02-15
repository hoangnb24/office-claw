import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNavGridRuntime } from "./pathfinding.mjs";

const SCENE_FILE_SUFFIX = ".scene.json";
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const DEFAULT_SCENE_DIR = path.join(WORKSPACE_ROOT, "assets", "scenes");

const navGridCache = new Map();

function normalizeSceneId(sceneId) {
  if (typeof sceneId !== "string" || sceneId.trim().length === 0) {
    return "cozy_office_v0";
  }
  return sceneId.trim();
}

function resolveSceneManifestPath(sceneId, { manifestPath, sceneDirectory } = {}) {
  if (typeof manifestPath === "string" && manifestPath.trim().length > 0) {
    return path.resolve(manifestPath);
  }

  const sceneDir =
    typeof sceneDirectory === "string" && sceneDirectory.trim().length > 0
      ? path.resolve(sceneDirectory)
      : DEFAULT_SCENE_DIR;
  return path.join(sceneDir, `${normalizeSceneId(sceneId)}${SCENE_FILE_SUFFIX}`);
}

function parseManifest(json, manifestPath) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`scene manifest must be an object: ${manifestPath}`);
  }

  if (!json.navigation || typeof json.navigation !== "object") {
    throw new Error(`scene manifest missing navigation: ${manifestPath}`);
  }

  if (!json.navigation.grid || typeof json.navigation.grid !== "object") {
    throw new Error(`scene manifest missing navigation.grid: ${manifestPath}`);
  }

  return json;
}

function cloneVec3(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  if (!value.every((token) => typeof token === "number" && Number.isFinite(token))) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

function parseDecorAnchors(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return [];
  }
  if (!manifest.decor_anchors || typeof manifest.decor_anchors !== "object") {
    return [];
  }

  const seen = new Set();
  const parsed = [];
  const entries = Object.entries(manifest.decor_anchors).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [groupId, anchors] of entries) {
    if (!Array.isArray(anchors)) {
      continue;
    }
    for (const anchor of anchors) {
      if (!anchor || typeof anchor !== "object") {
        continue;
      }
      const anchorId =
        typeof anchor.anchor_id === "string" && anchor.anchor_id.trim().length > 0
          ? anchor.anchor_id.trim()
          : null;
      if (!anchorId || seen.has(anchorId)) {
        continue;
      }
      seen.add(anchorId);
      parsed.push({
        group_id: groupId,
        anchor_id: anchorId,
        pos: cloneVec3(anchor.pos),
        facing: cloneVec3(anchor.facing)
      });
    }
  }
  return parsed;
}

function parsePoiAnchors(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.pois)) {
    return [];
  }
  const parsed = [];
  for (const poi of manifest.pois) {
    if (!poi || typeof poi !== "object") {
      continue;
    }
    const poiId = typeof poi.poi_id === "string" && poi.poi_id.trim().length > 0 ? poi.poi_id.trim() : null;
    if (!poiId || !Array.isArray(poi.nav_anchors)) {
      continue;
    }
    for (const navAnchor of poi.nav_anchors) {
      if (!navAnchor || typeof navAnchor !== "object") {
        continue;
      }
      const anchorId =
        typeof navAnchor.id === "string" && navAnchor.id.trim().length > 0 ? navAnchor.id.trim() : null;
      const pos = cloneVec3(navAnchor.pos);
      if (!anchorId || !pos) {
        continue;
      }
      parsed.push({
        poi_id: poiId,
        anchor_id: anchorId,
        pos,
        facing: cloneVec3(navAnchor.facing)
      });
    }
  }
  parsed.sort((left, right) => {
    if (left.poi_id === right.poi_id) {
      return left.anchor_id.localeCompare(right.anchor_id);
    }
    return left.poi_id.localeCompare(right.poi_id);
  });
  return parsed;
}

export function loadSceneNavGridRuntime(sceneId, options = {}) {
  const normalizedSceneId = normalizeSceneId(sceneId);
  const manifestPath = resolveSceneManifestPath(normalizedSceneId, options);
  const cacheKey = `${normalizedSceneId}:${manifestPath}`;

  if (!options.disableCache && navGridCache.has(cacheKey)) {
    return navGridCache.get(cacheKey);
  }

  let raw;
  try {
    raw = fs.readFileSync(manifestPath, "utf8");
  } catch (error) {
    throw new Error(`failed reading scene manifest at ${manifestPath}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`failed parsing scene manifest JSON at ${manifestPath}: ${error.message}`);
  }

  const manifest = parseManifest(parsed, manifestPath);
  const runtime = createNavGridRuntime(manifest.navigation.grid);
  const decorAnchors = parseDecorAnchors(manifest);
  const poiAnchors = parsePoiAnchors(manifest);
  const loaded = {
    sceneId: typeof manifest.scene_id === "string" ? manifest.scene_id : normalizedSceneId,
    manifestPath,
    grid: runtime,
    decorAnchors,
    poiAnchors
  };

  if (!options.disableCache) {
    navGridCache.set(cacheKey, loaded);
  }

  return loaded;
}

export function clearSceneNavGridCache() {
  navGridCache.clear();
}
