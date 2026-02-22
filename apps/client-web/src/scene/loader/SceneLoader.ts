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

export interface SceneObjectRenderPolicy {
  cast_shadow?: boolean;
  receive_shadow?: boolean;
  cull_distance_m?: number;
}

export interface SceneObjectSpec {
  id: string;
  url: string;
  transform: Transform;
  tags?: string[];
  collider?: false | SceneObjectCollider;
  interaction?: SceneObjectInteraction;
  render_policy?: SceneObjectRenderPolicy;
  instance_group?: string;
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

export interface SceneLightingProfile {
  mood?: "cozy_day" | "cozy_evening" | "focused_night" | "neutral";
  ambient_intensity?: number;
  key_intensity?: number;
  fill_intensity?: number;
  key_color?: string;
  fill_color?: string;
  fog_near_scale?: number;
  fog_far_scale?: number;
}

export interface SceneAmbienceProfile {
  motion_intensity?: number;
  cue_duration_ms?: number;
  cue_pulse_hz?: number;
}

export interface SceneFxAnchor {
  id: string;
  pos: Vec3;
  kind?: string;
  radius_m?: number;
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
  lighting_profile?: SceneLightingProfile;
  ambience_profile?: SceneAmbienceProfile;
  fx_anchors?: Record<string, SceneFxAnchor[]>;
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
  lightingProfile?: SceneLightingProfile;
  ambienceProfile?: SceneAmbienceProfile;
  fxAnchors?: Record<string, SceneFxAnchor[]>;
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

function asOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function asOptionalPositiveNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new Error(`${label} must be a number > 0`);
  }
  return value;
}

function asOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function asOptionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function normalizeServedAssetUrl(value: unknown, label: string): string {
  const raw = asString(value, label).trim();
  if (raw.startsWith("/assets/")) {
    return raw;
  }
  if (raw.startsWith("assets/")) {
    return `/${raw}`;
  }
  if (raw.startsWith("./assets/")) {
    return `/${raw.slice(2)}`;
  }
  throw new Error(`${label} must use served asset root /assets/...`);
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
    url: normalizeServedAssetUrl(officeShell.url, "office_shell.url"),
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
    const renderPolicyRaw = obj.render_policy;
    const colliderRaw = obj.collider;
    return {
      id: asString(obj.id, `objects[${index}].id`),
      url: normalizeServedAssetUrl(obj.url, `objects[${index}].url`),
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
      render_policy:
        renderPolicyRaw && typeof renderPolicyRaw === "object"
          ? {
              cast_shadow: asOptionalBoolean(
                (renderPolicyRaw as Record<string, unknown>).cast_shadow,
                `objects[${index}].render_policy.cast_shadow`
              ),
              receive_shadow: asOptionalBoolean(
                (renderPolicyRaw as Record<string, unknown>).receive_shadow,
                `objects[${index}].render_policy.receive_shadow`
              ),
              cull_distance_m: asOptionalPositiveNumber(
                (renderPolicyRaw as Record<string, unknown>).cull_distance_m,
                `objects[${index}].render_policy.cull_distance_m`
              )
            }
          : undefined,
      instance_group:
        typeof obj.instance_group === "string" && obj.instance_group.trim().length > 0
          ? obj.instance_group.trim()
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

  const lightingProfileRaw =
    root.lighting_profile && typeof root.lighting_profile === "object"
      ? (root.lighting_profile as Record<string, unknown>)
      : null;
  const lighting_profile = lightingProfileRaw
    ? ({
        mood:
          lightingProfileRaw.mood === "cozy_day" ||
          lightingProfileRaw.mood === "cozy_evening" ||
          lightingProfileRaw.mood === "focused_night" ||
          lightingProfileRaw.mood === "neutral"
            ? lightingProfileRaw.mood
            : undefined,
        ambient_intensity: asOptionalFiniteNumber(
          lightingProfileRaw.ambient_intensity,
          "lighting_profile.ambient_intensity"
        ),
        key_intensity: asOptionalFiniteNumber(
          lightingProfileRaw.key_intensity,
          "lighting_profile.key_intensity"
        ),
        fill_intensity: asOptionalFiniteNumber(
          lightingProfileRaw.fill_intensity,
          "lighting_profile.fill_intensity"
        ),
        key_color: asOptionalString(lightingProfileRaw.key_color, "lighting_profile.key_color"),
        fill_color: asOptionalString(lightingProfileRaw.fill_color, "lighting_profile.fill_color"),
        fog_near_scale: asOptionalPositiveNumber(
          lightingProfileRaw.fog_near_scale,
          "lighting_profile.fog_near_scale"
        ),
        fog_far_scale: asOptionalPositiveNumber(
          lightingProfileRaw.fog_far_scale,
          "lighting_profile.fog_far_scale"
        )
      } satisfies SceneLightingProfile)
    : undefined;

  const ambienceProfileRaw =
    root.ambience_profile && typeof root.ambience_profile === "object"
      ? (root.ambience_profile as Record<string, unknown>)
      : null;
  const ambience_profile = ambienceProfileRaw
    ? ({
        motion_intensity: asOptionalPositiveNumber(
          ambienceProfileRaw.motion_intensity,
          "ambience_profile.motion_intensity"
        ),
        cue_duration_ms: asOptionalPositiveNumber(
          ambienceProfileRaw.cue_duration_ms,
          "ambience_profile.cue_duration_ms"
        ),
        cue_pulse_hz: asOptionalPositiveNumber(
          ambienceProfileRaw.cue_pulse_hz,
          "ambience_profile.cue_pulse_hz"
        )
      } satisfies SceneAmbienceProfile)
    : undefined;

  const fxAnchorsRaw =
    root.fx_anchors && typeof root.fx_anchors === "object"
      ? (root.fx_anchors as Record<string, unknown>)
      : {};
  const fx_anchors = Object.fromEntries(
    Object.entries(fxAnchorsRaw).map(([groupId, anchors]) => [
      groupId,
      (Array.isArray(anchors) ? anchors : []).map((anchor, index) => {
        const anchorObj = asObject(anchor, `fx_anchors.${groupId}[${index}]`);
        return {
          id: asString(anchorObj.id, `fx_anchors.${groupId}[${index}].id`),
          pos: asVec3(anchorObj.pos, `fx_anchors.${groupId}[${index}].pos`),
          kind: asOptionalString(anchorObj.kind, `fx_anchors.${groupId}[${index}].kind`),
          radius_m: asOptionalPositiveNumber(
            anchorObj.radius_m,
            `fx_anchors.${groupId}[${index}].radius_m`
          )
        };
      })
    ])
  ) as Record<string, SceneFxAnchor[]>;

  const parsed: SceneManifest = {
    scene_id,
    version: typeof root.version === "number" ? root.version : undefined,
    office_shell,
    pois,
    objects,
    navigation,
    spawns,
    decor_anchors,
    lighting_profile,
    ambience_profile,
    fx_anchors
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
    lightingProfile: manifest.lighting_profile,
    ambienceProfile: manifest.ambience_profile,
    fxAnchors: manifest.fx_anchors,
    issues
  };
}
