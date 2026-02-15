import type { AnimationClip, Object3D } from "three";
import type { AssetManager } from "../assets/AssetManager";

type Vec3 = [number, number, number];

interface Transform {
  pos: Vec3;
  rot?: Vec3;
  scale?: Vec3;
}

interface PoiNavAnchor {
  id: string;
  pos: Vec3;
  facing?: Vec3;
}

interface PoiInteraction {
  type: string;
  panel?: string;
}

export interface ScenePoi {
  poi_id: string;
  type: string;
  nav_anchors: PoiNavAnchor[];
  interaction_radius_m?: number;
  highlight_nodes?: string[];
  interaction?: PoiInteraction;
}

interface SceneObjectCollider {
  type: string;
  size?: Vec3;
  offset?: Vec3;
}

interface SceneObjectInteraction {
  type: string;
  panel?: string;
}

export interface SceneObjectSpec {
  id: string;
  url: string;
  transform: Transform;
  tags?: string[];
  collider?: false | SceneObjectCollider;
  interaction?: SceneObjectInteraction;
  poi_id?: string;
  interaction_radius_m?: number;
  highlight_nodes?: string[];
}

interface SceneNavigationGrid {
  origin: [number, number];
  cell_size: number;
  width: number;
  height: number;
  walkable: number[] | string;
}

interface SceneSpawns {
  player?: Vec3;
  agents?: Record<string, Vec3>;
}

interface SceneDecorAnchor {
  anchor_id: string;
  pos: Vec3;
  facing?: Vec3;
}

export interface SceneManifest {
  scene_id: string;
  version?: number;
  office_shell: {
    url: string;
    transform: Transform;
  };
  pois: ScenePoi[];
  objects: SceneObjectSpec[];
  navigation: {
    grid: SceneNavigationGrid;
  };
  spawns?: SceneSpawns;
  decor_anchors?: Record<string, SceneDecorAnchor[]>;
}

interface LoadedAsset {
  id: string;
  url: string;
  root: Object3D;
  animations: AnimationClip[];
}

export interface SceneRuntimeData {
  sceneId: string;
  shell: LoadedAsset;
  objects: LoadedAsset[];
  poisById: Record<string, ScenePoi>;
  objectsById: Record<string, SceneObjectSpec>;
  interactiveObjectIds: string[];
  colliderObjectIds: string[];
  navigationGrid: SceneNavigationGrid;
  spawns: SceneSpawns;
  decorAnchors: Record<string, SceneDecorAnchor[]>;
  issues: string[];
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function asVec3(value: unknown, label: string): Vec3 {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((item) => typeof item !== "number" || Number.isNaN(item))
  ) {
    throw new Error(`${label} must be a 3-number tuple`);
  }
  return [value[0], value[1], value[2]];
}

function asTransform(value: unknown, label: string): Transform {
  const object = asObject(value, label);
  const pos = asVec3(object.pos, `${label}.pos`);
  const rot = object.rot === undefined ? undefined : asVec3(object.rot, `${label}.rot`);
  const scale =
    object.scale === undefined ? undefined : asVec3(object.scale, `${label}.scale`);
  return { pos, rot, scale };
}

function applyTransform(root: Object3D, transform: Transform) {
  root.position.set(...transform.pos);
  const rot = transform.rot ?? [0, 0, 0];
  const scale = transform.scale ?? [1, 1, 1];
  root.rotation.set(...rot);
  root.scale.set(...scale);
}

function validateManifest(manifest: SceneManifest) {
  if (!manifest.scene_id) {
    throw new Error("scene_id is required");
  }
  if (!manifest.office_shell?.url) {
    throw new Error("office_shell.url is required");
  }
  if (!Array.isArray(manifest.pois) || manifest.pois.length === 0) {
    throw new Error("pois must be a non-empty array");
  }
  if (!Array.isArray(manifest.objects)) {
    throw new Error("objects must be an array");
  }
  if (!manifest.navigation?.grid) {
    throw new Error("navigation.grid is required");
  }
  if (manifest.navigation.grid.width <= 0 || manifest.navigation.grid.height <= 0) {
    throw new Error("navigation.grid width/height must be > 0");
  }

  const poiIds = new Set(manifest.pois.map((poi) => poi.poi_id));
  for (const object of manifest.objects) {
    if (object.interaction && !object.poi_id) {
      throw new Error(`object ${object.id} has interaction but missing poi_id`);
    }
    if (object.poi_id && !poiIds.has(object.poi_id)) {
      throw new Error(`object ${object.id} references unknown poi_id: ${object.poi_id}`);
    }
  }
}

export function parseSceneManifest(raw: unknown): SceneManifest {
  const root = asObject(raw, "scene manifest");

  const scene_id = asString(root.scene_id, "scene_id");
  const officeShell = asObject(root.office_shell, "office_shell");
  const office_shell = {
    url: asString(officeShell.url, "office_shell.url"),
    transform: asTransform(officeShell.transform, "office_shell.transform")
  };

  const pois = (Array.isArray(root.pois) ? root.pois : []).map((poi, index) => {
    const poiObj = asObject(poi, `pois[${index}]`);
    const navAnchors = Array.isArray(poiObj.nav_anchors) ? poiObj.nav_anchors : [];
    return {
      poi_id: asString(poiObj.poi_id, `pois[${index}].poi_id`),
      type: asString(poiObj.type, `pois[${index}].type`),
      nav_anchors: navAnchors.map((anchor, anchorIndex) => {
        const anchorObj = asObject(anchor, `pois[${index}].nav_anchors[${anchorIndex}]`);
        return {
          id: asString(anchorObj.id, `pois[${index}].nav_anchors[${anchorIndex}].id`),
          pos: asVec3(anchorObj.pos, `pois[${index}].nav_anchors[${anchorIndex}].pos`),
          facing:
            anchorObj.facing === undefined
              ? undefined
              : asVec3(anchorObj.facing, `pois[${index}].nav_anchors[${anchorIndex}].facing`)
        };
      }),
      interaction_radius_m:
        poiObj.interaction_radius_m === undefined
          ? undefined
          : Number(poiObj.interaction_radius_m),
      highlight_nodes: Array.isArray(poiObj.highlight_nodes)
        ? poiObj.highlight_nodes.filter((node) => typeof node === "string")
        : [],
      interaction:
        poiObj.interaction && typeof poiObj.interaction === "object"
          ? {
              type: asString((poiObj.interaction as Record<string, unknown>).type, `pois[${index}].interaction.type`),
              panel:
                typeof (poiObj.interaction as Record<string, unknown>).panel === "string"
                  ? ((poiObj.interaction as Record<string, unknown>).panel as string)
                  : undefined
            }
          : undefined
    } satisfies ScenePoi;
  });

  const objects = (Array.isArray(root.objects) ? root.objects : []).map((object, index) => {
    const obj = asObject(object, `objects[${index}]`);
    const interactionRaw = obj.interaction;
    const colliderRaw = obj.collider;
    return {
      id: asString(obj.id, `objects[${index}].id`),
      url: asString(obj.url, `objects[${index}].url`),
      transform: asTransform(obj.transform, `objects[${index}].transform`),
      tags: Array.isArray(obj.tags) ? obj.tags.filter((item) => typeof item === "string") : [],
      collider:
        colliderRaw === false
          ? false
          : colliderRaw && typeof colliderRaw === "object"
            ? {
                type: asString((colliderRaw as Record<string, unknown>).type, `objects[${index}].collider.type`),
                size:
                  (colliderRaw as Record<string, unknown>).size === undefined
                    ? undefined
                    : asVec3((colliderRaw as Record<string, unknown>).size, `objects[${index}].collider.size`),
                offset:
                  (colliderRaw as Record<string, unknown>).offset === undefined
                    ? undefined
                    : asVec3((colliderRaw as Record<string, unknown>).offset, `objects[${index}].collider.offset`)
              }
            : undefined,
      interaction:
        interactionRaw && typeof interactionRaw === "object"
          ? {
              type: asString((interactionRaw as Record<string, unknown>).type, `objects[${index}].interaction.type`),
              panel:
                typeof (interactionRaw as Record<string, unknown>).panel === "string"
                  ? ((interactionRaw as Record<string, unknown>).panel as string)
                  : undefined
            }
          : undefined,
      poi_id: typeof obj.poi_id === "string" ? obj.poi_id : undefined,
      interaction_radius_m:
        obj.interaction_radius_m === undefined ? undefined : Number(obj.interaction_radius_m),
      highlight_nodes: Array.isArray(obj.highlight_nodes)
        ? obj.highlight_nodes.filter((item) => typeof item === "string")
        : []
    } satisfies SceneObjectSpec;
  });

  const navRoot = asObject(root.navigation, "navigation");
  const navGrid = asObject(navRoot.grid, "navigation.grid");
  const navigation = {
    grid: {
      origin: [
        Number((navGrid.origin as [number, number])?.[0] ?? 0),
        Number((navGrid.origin as [number, number])?.[1] ?? 0)
      ] as [number, number],
      cell_size: Number(navGrid.cell_size),
      width: Number(navGrid.width),
      height: Number(navGrid.height),
      walkable:
        Array.isArray(navGrid.walkable) || typeof navGrid.walkable === "string"
          ? (navGrid.walkable as number[] | string)
          : []
    } satisfies SceneNavigationGrid
  };

  const spawnsRaw = root.spawns && typeof root.spawns === "object" ? root.spawns : {};
  const spawns = {
    player:
      (spawnsRaw as Record<string, unknown>).player === undefined
        ? undefined
        : asVec3((spawnsRaw as Record<string, unknown>).player, "spawns.player"),
    agents:
      (spawnsRaw as Record<string, unknown>).agents &&
      typeof (spawnsRaw as Record<string, unknown>).agents === "object"
        ? Object.fromEntries(
            Object.entries((spawnsRaw as Record<string, unknown>).agents as Record<string, unknown>).map(
              ([agentId, value]) => [agentId, asVec3(value, `spawns.agents.${agentId}`)]
            )
          )
        : {}
  } satisfies SceneSpawns;

  const decorRaw = root.decor_anchors && typeof root.decor_anchors === "object"
    ? (root.decor_anchors as Record<string, unknown>)
    : {};
  const decor_anchors = Object.fromEntries(
    Object.entries(decorRaw).map(([groupId, anchors]) => [
      groupId,
      (Array.isArray(anchors) ? anchors : []).map((anchor, index) => {
        const anchorObj = asObject(anchor, `decor_anchors.${groupId}[${index}]`);
        return {
          anchor_id: asString(anchorObj.anchor_id, `decor_anchors.${groupId}[${index}].anchor_id`),
          pos: asVec3(anchorObj.pos, `decor_anchors.${groupId}[${index}].pos`),
          facing:
            anchorObj.facing === undefined
              ? undefined
              : asVec3(anchorObj.facing, `decor_anchors.${groupId}[${index}].facing`)
        };
      })
    ])
  ) as Record<string, SceneDecorAnchor[]>;

  const parsed: SceneManifest = {
    scene_id,
    version: typeof root.version === "number" ? root.version : undefined,
    office_shell,
    pois,
    objects,
    navigation,
    spawns,
    decor_anchors
  };

  validateManifest(parsed);
  return parsed;
}

export async function fetchSceneManifest(sceneUrl: string): Promise<SceneManifest> {
  const response = await fetch(sceneUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch scene manifest (${response.status}): ${sceneUrl}`);
  }
  const raw = (await response.json()) as unknown;
  return parseSceneManifest(raw);
}

export async function loadSceneFromManifest(
  manifestOrUrl: SceneManifest | string,
  assetManager: AssetManager
): Promise<SceneRuntimeData> {
  const manifest =
    typeof manifestOrUrl === "string"
      ? await fetchSceneManifest(manifestOrUrl)
      : manifestOrUrl;

  const issues: string[] = [];
  const poisById = Object.fromEntries(manifest.pois.map((poi) => [poi.poi_id, poi]));
  const objectsById = Object.fromEntries(manifest.objects.map((obj) => [obj.id, obj]));
  const interactiveObjectIds = manifest.objects
    .filter((obj) => Boolean(obj.interaction))
    .map((obj) => obj.id);
  const colliderObjectIds = manifest.objects
    .filter((obj) => obj.collider !== false && obj.collider !== undefined)
    .map((obj) => obj.id);

  const shellClone = await assetManager.clone(manifest.office_shell.url);
  applyTransform(shellClone.root, manifest.office_shell.transform);

  const objectClones: LoadedAsset[] = [];
  for (const object of manifest.objects) {
    try {
      const cloned = await assetManager.clone(object.url);
      applyTransform(cloned.root, object.transform);
      objectClones.push({
        id: object.id,
        url: object.url,
        root: cloned.root,
        animations: cloned.animations
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown object clone failure";
      issues.push(`object:${object.id}: ${message}`);
    }
  }

  return {
    sceneId: manifest.scene_id,
    shell: {
      id: "office_shell",
      url: manifest.office_shell.url,
      root: shellClone.root,
      animations: shellClone.animations
    },
    objects: objectClones,
    poisById,
    objectsById,
    interactiveObjectIds,
    colliderObjectIds,
    navigationGrid: manifest.navigation.grid,
    spawns: manifest.spawns ?? { agents: {} },
    decorAnchors: manifest.decor_anchors ?? {},
    issues
  };
}
