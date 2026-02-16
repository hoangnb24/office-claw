import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { PoiFocusConfig } from "../focus/poiFocusManifest";
import type { AssetManager } from "../assets/AssetManager";
import { assetManager as defaultAssetManager } from "../assets/assetManagerSingleton";
import {
  applyColliderBlockers,
  collectColliderBlockedIndices,
  createNavGridRuntime,
  validatePoiAnchorReachability,
  type NavAnchorReachabilityIssue,
  type NavGridRuntime
} from "../nav/pathfinding";
import type {
  SceneManifest,
  SceneObjectSpec,
  ScenePoi,
  SceneRuntimeData
} from "../loader";
import { fetchSceneManifest, loadSceneFromManifest } from "../loader";
import {
  buildInstancedObjectGroups,
  type InstancedAssemblyResult
} from "../render";
import { useWorldStore } from "../../state/worldStore";

export type SceneRuntimeStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "degraded"
  | "error";

export type SceneRuntimeLoadPhase =
  | "idle"
  | "fetch_manifest"
  | "validate_manifest"
  | "derive_indices"
  | "load_assets"
  | "complete"
  | "failed";

export interface SceneRuntimeProgress {
  phase: SceneRuntimeLoadPhase;
  percent: number;
  label: string;
}

export type SceneRuntimeIssueSeverity = "error" | "warning";

export type SceneRuntimeIssueSource =
  | "manifest_validation"
  | "asset_loading"
  | "nav_validation"
  | "provider_runtime";

export interface SceneRuntimeIssue {
  id: string;
  ts: number;
  severity: SceneRuntimeIssueSeverity;
  source: SceneRuntimeIssueSource;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type SceneObjectLoadBucket = "critical" | "decor";

export interface SceneRuntimeInstancingStats {
  groupCount: number;
  instancedObjectCount: number;
  fallbackObjectCount: number;
  candidateExclusionCount: number;
  assemblyExclusionCount: number;
  estimatedDrawCallSavings: number;
}

export interface SceneRuntimeDerivedIndices {
  poisById: Record<string, ScenePoi>;
  objectsById: Record<string, SceneObjectSpec>;
  poiHighlightNodesById: Record<string, string[]>;
  poiFocusConfigById: Record<string, PoiFocusConfig>;
  navigationGrid: NavGridRuntime | null;
  navAnchorIssues: NavAnchorReachabilityIssue[];
  instancedAssembly: InstancedAssemblyResult;
  instancingStats: SceneRuntimeInstancingStats;
}

export interface SceneRuntimeSnapshot {
  sceneId: string;
  manifestUrl: string;
  status: SceneRuntimeStatus;
  progress: SceneRuntimeProgress;
  manifest: SceneManifest | null;
  runtimeData: SceneRuntimeData | null;
  derived: SceneRuntimeDerivedIndices | null;
  issues: SceneRuntimeIssue[];
  updatedAtMs: number | null;
}

export interface SceneRuntimeLoadOptions {
  sceneId: string;
  manifestUrl: string;
  forceReload?: boolean;
}

export interface SceneRuntimeProviderValue {
  snapshot: SceneRuntimeSnapshot;
  loadScene: (options: SceneRuntimeLoadOptions) => Promise<void>;
  reloadScene: () => Promise<void>;
  clearIssues: () => void;
  getPoi: (poiId: string) => ScenePoi | null;
  getObject: (objectId: string) => SceneObjectSpec | null;
  getHighlightNodes: (poiId: string) => string[];
  getPoiFocusConfig: (poiId: string) => PoiFocusConfig | null;
}

export interface SceneRuntimeProviderProps {
  children: ReactNode;
  initialSceneId?: string;
  initialManifestUrl?: string;
  autoLoad?: boolean;
  assetManager?: AssetManager;
}

const DEFAULT_SCENE_ID = "cozy_office_v0";
const DEFAULT_SNAPSHOT: SceneRuntimeSnapshot = {
  sceneId: DEFAULT_SCENE_ID,
  manifestUrl: "",
  status: "idle",
  progress: {
    phase: "idle",
    percent: 0,
    label: "Idle"
  },
  manifest: null,
  runtimeData: null,
  derived: null,
  issues: [],
  updatedAtMs: null
};

const DEFAULT_CAMERA_OFFSET: [number, number, number] = [0, 1.2, 1.8];
const EMPTY_INSTANCED_ASSEMBLY: InstancedAssemblyResult = Object.freeze({
  groups: [],
  fallbackObjectIds: [],
  candidateExclusions: [],
  assemblyExclusions: []
});
const EMPTY_INSTANCING_STATS: SceneRuntimeInstancingStats = Object.freeze({
  groupCount: 0,
  instancedObjectCount: 0,
  fallbackObjectCount: 0,
  candidateExclusionCount: 0,
  assemblyExclusionCount: 0,
  estimatedDrawCallSavings: 0
});

interface ManifestValidationFinding {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

class ManifestValidationError extends Error {
  issues: SceneRuntimeIssue[];
  manifest: SceneManifest;

  constructor(issues: SceneRuntimeIssue[], manifest: SceneManifest) {
    super("Scene manifest failed provider contract validation.");
    this.name = "ManifestValidationError";
    this.issues = issues;
    this.manifest = manifest;
  }
}

class AssetLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetLoadError";
  }
}

function toIssue(
  source: SceneRuntimeIssueSource,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  severity: SceneRuntimeIssueSeverity = "error"
): SceneRuntimeIssue {
  return {
    id: `${source}:${code}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    severity,
    source,
    code,
    message,
    details
  };
}

function normalizeLoadOptions(options: SceneRuntimeLoadOptions): SceneRuntimeLoadOptions {
  return {
    sceneId: options.sceneId.trim(),
    manifestUrl: options.manifestUrl.trim(),
    forceReload: options.forceReload === true
  };
}

export function classifySceneObjectLoadBucket(object: SceneObjectSpec): SceneObjectLoadBucket {
  const tags = object.tags ?? [];
  if (tags.includes("critical")) {
    return "critical";
  }
  if (tags.includes("decor")) {
    return "decor";
  }

  const interactionCritical = Boolean(object.interaction) || Boolean(object.poi_id);
  const colliderCritical = object.collider !== false && object.collider !== undefined;
  return interactionCritical || colliderCritical ? "critical" : "decor";
}

function planManifestLoadOrder(manifest: SceneManifest): {
  loadManifest: SceneManifest;
  criticalObjectIds: string[];
  decorObjectIds: string[];
} {
  const criticalObjects: SceneObjectSpec[] = [];
  const decorObjects: SceneObjectSpec[] = [];

  for (const object of manifest.objects) {
    if (classifySceneObjectLoadBucket(object) === "critical") {
      criticalObjects.push(object);
    } else {
      decorObjects.push(object);
    }
  }

  criticalObjects.sort((left, right) => left.id.localeCompare(right.id));
  decorObjects.sort((left, right) => left.id.localeCompare(right.id));

  return {
    loadManifest: {
      ...manifest,
      objects: [...criticalObjects, ...decorObjects]
    },
    criticalObjectIds: criticalObjects.map((object) => object.id),
    decorObjectIds: decorObjects.map((object) => object.id)
  };
}

function focusConfigFromPoi(poi: ScenePoi): PoiFocusConfig {
  const navAnchorPos = poi.nav_anchors[0]?.pos ?? [0, 0, 0];

  return {
    poiId: poi.poi_id,
    focusPoint: navAnchorPos,
    panelAnchor: navAnchorPos,
    cameraOffset: DEFAULT_CAMERA_OFFSET,
    zoomMultiplier: 1
  };
}

function getPoiFromManifest(manifest: SceneManifest | null, poiId: string): ScenePoi | null {
  if (!manifest) {
    return null;
  }
  return manifest.pois.find((poi) => poi.poi_id === poiId) ?? null;
}

function getObjectFromManifest(
  manifest: SceneManifest | null,
  objectId: string
): SceneObjectSpec | null {
  if (!manifest) {
    return null;
  }
  return manifest.objects.find((object) => object.id === objectId) ?? null;
}

function getHighlightNodesFromManifest(
  manifest: SceneManifest | null,
  poiId: string
): string[] {
  if (!manifest) {
    return [];
  }

  const fromPoi = manifest.pois.find((poi) => poi.poi_id === poiId)?.highlight_nodes ?? [];
  const fromObjects = manifest.objects
    .filter((object) => object.poi_id === poiId)
    .flatMap((object) => object.highlight_nodes ?? []);

  return [...new Set([...fromPoi, ...fromObjects])];
}

function buildDerivedIndices(manifest: SceneManifest): SceneRuntimeDerivedIndices {
  const poisById = Object.fromEntries(
    manifest.pois.map((poi) => [poi.poi_id, poi] as const)
  );
  const objectsById = Object.fromEntries(
    manifest.objects.map((object) => [object.id, object] as const)
  );

  const poiHighlightNodesById: Record<string, string[]> = {};
  for (const poi of manifest.pois) {
    poiHighlightNodesById[poi.poi_id] = [...new Set(poi.highlight_nodes ?? [])];
  }
  for (const object of manifest.objects) {
    if (!object.poi_id) {
      continue;
    }
    const existing = poiHighlightNodesById[object.poi_id] ?? [];
    const merged = [...existing, ...(object.highlight_nodes ?? [])];
    poiHighlightNodesById[object.poi_id] = [...new Set(merged)];
  }

  const poiFocusConfigById = Object.fromEntries(
    manifest.pois.map((poi) => [poi.poi_id, focusConfigFromPoi(poi)] as const)
  );

  const baseNavGrid = createNavGridRuntime(manifest.navigation.grid);
  const blocked = collectColliderBlockedIndices(manifest, baseNavGrid);
  const navigationGrid = applyColliderBlockers(baseNavGrid, blocked.blockedIndices);
  const navAnchorIssues = validatePoiAnchorReachability(manifest, navigationGrid);

  return {
    poisById,
    objectsById,
    poiHighlightNodesById,
    poiFocusConfigById,
    navigationGrid,
    navAnchorIssues,
    instancedAssembly: EMPTY_INSTANCED_ASSEMBLY,
    instancingStats: EMPTY_INSTANCING_STATS
  };
}

function buildRuntimeInstancedAssembly(
  objectsById: Record<string, SceneObjectSpec>,
  runtimeData: SceneRuntimeData
): InstancedAssemblyResult {
  const entries: Array<{
    loaded: SceneRuntimeData["objects"][number];
    spec: SceneObjectSpec;
  }> = [];

  for (const loaded of runtimeData.objects) {
    const spec = objectsById[loaded.id];
    if (!spec) {
      continue;
    }
    entries.push({ loaded, spec });
  }

  return buildInstancedObjectGroups(entries);
}

function summarizeInstancedAssembly(
  assembly: InstancedAssemblyResult
): SceneRuntimeInstancingStats {
  const instancedObjectCount = assembly.groups.reduce(
    (sum, group) => sum + group.objectIds.length,
    0
  );
  return {
    groupCount: assembly.groups.length,
    instancedObjectCount,
    fallbackObjectCount: assembly.fallbackObjectIds.length,
    candidateExclusionCount: assembly.candidateExclusions.length,
    assemblyExclusionCount: assembly.assemblyExclusions.length,
    estimatedDrawCallSavings: Math.max(0, instancedObjectCount - assembly.groups.length)
  };
}

function attachRuntimeInstancing(
  derived: SceneRuntimeDerivedIndices,
  runtimeData: SceneRuntimeData
): SceneRuntimeDerivedIndices {
  const instancedAssembly = buildRuntimeInstancedAssembly(derived.objectsById, runtimeData);
  return {
    ...derived,
    instancedAssembly,
    instancingStats: summarizeInstancedAssembly(instancedAssembly)
  };
}

function validateManifestAgainstContracts(manifest: SceneManifest): ManifestValidationFinding[] {
  const findings: ManifestValidationFinding[] = [];

  if (!Number.isInteger(manifest.version) || (manifest.version ?? 0) < 1) {
    findings.push({
      code: "manifest_version_invalid",
      message: "scene manifest version must be an integer >= 1 (contracts schema).",
      details: {
        version: manifest.version ?? null
      }
    });
  }

  const poiIds = new Set<string>();
  manifest.pois.forEach((poi, poiIndex) => {
    if (poiIds.has(poi.poi_id)) {
      findings.push({
        code: "poi_id_duplicate",
        message: `pois[${poiIndex}].poi_id is duplicated: ${poi.poi_id}`,
        details: {
          poiId: poi.poi_id
        }
      });
    }
    poiIds.add(poi.poi_id);

    if (!Array.isArray(poi.highlight_nodes) || poi.highlight_nodes.length === 0) {
      findings.push({
        code: "poi_highlight_nodes_missing",
        message: `pois[${poiIndex}].highlight_nodes must include at least one node`,
        details: {
          poiId: poi.poi_id
        }
      });
    } else if (new Set(poi.highlight_nodes).size !== poi.highlight_nodes.length) {
      findings.push({
        code: "poi_highlight_nodes_duplicate",
        message: `pois[${poiIndex}].highlight_nodes contains duplicate entries`,
        details: {
          poiId: poi.poi_id
        }
      });
    }

    const anchorIds = new Set<string>();
    poi.nav_anchors.forEach((anchor, anchorIndex) => {
      if (anchorIds.has(anchor.id)) {
        findings.push({
          code: "poi_nav_anchor_id_duplicate",
          message: `pois[${poiIndex}].nav_anchors[${anchorIndex}].id duplicated: ${anchor.id}`,
          details: {
            poiId: poi.poi_id,
            anchorId: anchor.id
          }
        });
      }
      anchorIds.add(anchor.id);
    });
  });

  manifest.objects.forEach((object, objectIndex) => {
    if (object.poi_id && !poiIds.has(object.poi_id)) {
      findings.push({
        code: "object_poi_reference_missing",
        message: `objects[${objectIndex}].poi_id references missing POI: ${object.poi_id}`,
        details: {
          objectId: object.id,
          poiId: object.poi_id
        }
      });
    }

    if (object.interaction && !object.poi_id) {
      findings.push({
        code: "object_interaction_missing_poi",
        message: `objects[${objectIndex}] defines interaction but is missing poi_id for routing`,
        details: {
          objectId: object.id
        }
      });
    }

    if (Array.isArray(object.highlight_nodes)) {
      if (new Set(object.highlight_nodes).size !== object.highlight_nodes.length) {
        findings.push({
          code: "object_highlight_nodes_duplicate",
          message: `objects[${objectIndex}].highlight_nodes contains duplicate entries`,
          details: {
            objectId: object.id
          }
        });
      }
    }

    if (object.collider && typeof object.collider === "object") {
      if (object.collider.type === "box") {
        const size = object.collider.size;
        if (!Array.isArray(size) || size.length !== 3 || size.some((value) => value <= 0)) {
          findings.push({
            code: "object_collider_box_size_invalid",
            message: `objects[${objectIndex}].collider.size must contain 3 positive numbers`,
            details: {
              objectId: object.id,
              colliderType: object.collider.type
            }
          });
        }
      }

      if (object.collider.type === "capsule") {
        const colliderCapsule = object.collider as {
          radius?: number;
          height?: number;
        };
        const radiusValid =
          typeof colliderCapsule.radius === "number" && colliderCapsule.radius > 0;
        const heightValid =
          typeof colliderCapsule.height === "number" && colliderCapsule.height > 0;
        if (!radiusValid || !heightValid) {
          findings.push({
            code: "object_collider_capsule_invalid",
            message:
              `objects[${objectIndex}].collider capsule requires positive radius and height`,
            details: {
              objectId: object.id,
              colliderType: object.collider.type
            }
          });
        }
      }
    }
  });

  const grid = manifest.navigation.grid;
  if (Array.isArray(grid.walkable)) {
    const expectedCellCount = grid.width * grid.height;
    if (grid.walkable.length !== expectedCellCount) {
      findings.push({
        code: "navigation_walkable_length_mismatch",
        message:
          `navigation.grid.walkable length ${grid.walkable.length} does not match width*height ${expectedCellCount}`,
        details: {
          width: grid.width,
          height: grid.height,
          walkableLength: grid.walkable.length
        }
      });
    }

    const nonBinaryIndex = grid.walkable.findIndex((cell) => cell !== 0 && cell !== 1);
    if (nonBinaryIndex >= 0) {
      findings.push({
        code: "navigation_walkable_values_invalid",
        message:
          `navigation.grid.walkable[${nonBinaryIndex}] must be 0 or 1 for array encoding`,
        details: {
          index: nonBinaryIndex,
          value: grid.walkable[nonBinaryIndex]
        }
      });
    }
  }

  if (manifest.decor_anchors) {
    const seenDecorAnchorIds = new Set<string>();
    for (const [groupId, anchors] of Object.entries(manifest.decor_anchors)) {
      anchors.forEach((anchor, anchorIndex) => {
        if (seenDecorAnchorIds.has(anchor.anchor_id)) {
          findings.push({
            code: "decor_anchor_id_duplicate",
            message:
              `decor_anchors.${groupId}[${anchorIndex}].anchor_id is duplicated: ${anchor.anchor_id}`,
            details: {
              groupId,
              anchorId: anchor.anchor_id
            }
          });
        }
        seenDecorAnchorIds.add(anchor.anchor_id);
      });
    }
  }

  return findings;
}

export const SceneRuntimeContext = createContext<SceneRuntimeProviderValue | null>(
  null
);

export function SceneRuntimeProvider({
  children,
  initialSceneId = DEFAULT_SCENE_ID,
  initialManifestUrl,
  autoLoad = false,
  assetManager: runtimeAssetManager = defaultAssetManager
}: SceneRuntimeProviderProps) {
  const [snapshot, setSnapshot] = useState<SceneRuntimeSnapshot>(() => ({
    ...DEFAULT_SNAPSHOT,
    sceneId: initialSceneId
  }));
  const snapshotRef = useRef(snapshot);
  const lastLoadOptionsRef = useRef<SceneRuntimeLoadOptions | null>(null);
  const latestLoadTokenRef = useRef(0);
  const manifestCacheRef = useRef<Map<string, SceneManifest>>(new Map());
  const inFlightFetchRef = useRef<Map<string, Promise<SceneManifest>>>(new Map());

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const fetchManifest = useCallback(async (options: SceneRuntimeLoadOptions) => {
    const cacheKey = `${options.sceneId}:${options.manifestUrl}`;

    if (options.forceReload) {
      manifestCacheRef.current.delete(cacheKey);
    } else {
      const cachedManifest = manifestCacheRef.current.get(cacheKey);
      if (cachedManifest) {
        return cachedManifest;
      }

      const inFlight = inFlightFetchRef.current.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }
    }

    const fetchPromise = fetchSceneManifest(options.manifestUrl)
      .then((manifest) => {
        manifestCacheRef.current.set(cacheKey, manifest);
        return manifest;
      })
      .finally(() => {
        inFlightFetchRef.current.delete(cacheKey);
      });

    inFlightFetchRef.current.set(cacheKey, fetchPromise);
    return fetchPromise;
  }, []);

  const loadScene = useCallback(
    async (rawOptions: SceneRuntimeLoadOptions) => {
      const options = normalizeLoadOptions(rawOptions);
      const cacheKey = `${options.sceneId}:${options.manifestUrl}`;
      if (!options.sceneId || !options.manifestUrl) {
        const issue = toIssue(
          "provider_runtime",
          "invalid_load_options",
          "sceneId and manifestUrl are required for SceneRuntimeProvider.loadScene()."
        );
        setSnapshot((prev) => ({
          ...prev,
          status: "error",
          progress: {
            phase: "failed",
            percent: 0,
            label: "Invalid load options"
          },
          issues: [issue],
          runtimeData: null,
          derived: null,
          updatedAtMs: issue.ts
        }));
        throw new Error(issue.message);
      }

      const currentSnapshot = snapshotRef.current;
      if (
        !options.forceReload &&
        (currentSnapshot.status === "loaded" || currentSnapshot.status === "degraded") &&
        currentSnapshot.sceneId === options.sceneId &&
        currentSnapshot.manifestUrl === options.manifestUrl &&
        currentSnapshot.manifest
      ) {
        return;
      }

      const loadToken = latestLoadTokenRef.current + 1;
      latestLoadTokenRef.current = loadToken;
      lastLoadOptionsRef.current = {
        sceneId: options.sceneId,
        manifestUrl: options.manifestUrl
      };

      setSnapshot((prev) => ({
        ...prev,
        sceneId: options.sceneId,
        manifestUrl: options.manifestUrl,
        status: "loading",
        progress: {
          phase: "fetch_manifest",
          percent: 20,
          label: "Fetching scene manifest"
        },
        issues: [],
        updatedAtMs: Date.now()
      }));

      try {
        const manifest = await fetchManifest(options);

        setSnapshot((prev) => ({
          ...prev,
          progress: {
            phase: "validate_manifest",
            percent: 45,
            label: "Validating scene manifest"
          }
        }));

        const validationFindings = validateManifestAgainstContracts(manifest);
        if (validationFindings.length > 0) {
          manifestCacheRef.current.delete(cacheKey);
          const validationIssues = validationFindings.map((finding) =>
            toIssue("manifest_validation", finding.code, finding.message, finding.details)
          );
          throw new ManifestValidationError(validationIssues, manifest);
        }

        setSnapshot((prev) => ({
          ...prev,
          progress: {
            phase: "derive_indices",
            percent: 70,
            label: "Building derived runtime indices"
          }
        }));

        const derived = buildDerivedIndices(manifest);
        const loadOrderPlan = planManifestLoadOrder(manifest);
        const startupTotal = 1 + manifest.objects.length;
        useWorldStore.getState().beginAssetStartup(startupTotal);

        setSnapshot((prev) => ({
          ...prev,
          progress: {
            phase: "load_assets",
            percent: 85,
            label:
              `Loading assets (shell -> critical:${loadOrderPlan.criticalObjectIds.length}` +
              ` -> decor:${loadOrderPlan.decorObjectIds.length})`
          }
        }));

        let runtimeData: SceneRuntimeData;
        try {
          runtimeData = await loadSceneFromManifest(loadOrderPlan.loadManifest, runtimeAssetManager);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown scene asset load failure.";
          throw new AssetLoadError(message);
        }

        if (loadToken !== latestLoadTokenRef.current) {
          return;
        }

        const loadedObjectIds = new Set(runtimeData.objects.map((object) => object.id));
        const criticalObjectIdSet = new Set(loadOrderPlan.criticalObjectIds);
        const startupStore = useWorldStore.getState();
        startupStore.markAssetLoaded("office_shell", 0);
        for (const object of manifest.objects) {
          if (loadedObjectIds.has(object.id)) {
            startupStore.markAssetLoaded(object.id, 0);
            continue;
          }
          startupStore.markAssetFailed(
            object.id,
            0,
            criticalObjectIdSet.has(object.id),
            `scene object failed to load: ${object.id}`
          );
        }

        const derivedWithRuntime = attachRuntimeInstancing(derived, runtimeData);
        const navWarningIssues =
          derivedWithRuntime.navAnchorIssues.length > 0
            ? [
                toIssue(
                  "nav_validation",
                  "nav_anchor_issues_detected",
                  `Detected ${derivedWithRuntime.navAnchorIssues.length} nav anchor reachability issue(s).`,
                  {
                    issueCount: derivedWithRuntime.navAnchorIssues.length,
                    sample: derivedWithRuntime.navAnchorIssues.slice(0, 3)
                  },
                  "warning"
                )
              ]
            : [];
        const criticalMissing = loadOrderPlan.criticalObjectIds.filter(
          (objectId) => !loadedObjectIds.has(objectId)
        );
        const decorMissing = loadOrderPlan.decorObjectIds.filter(
          (objectId) => !loadedObjectIds.has(objectId)
        );
        const assetWarningIssues =
          runtimeData.issues.length > 0
            ? [
                toIssue(
                  "asset_loading",
                  "asset_object_load_warnings",
                  `Loaded scene with ${runtimeData.issues.length} non-fatal asset issue(s)` +
                    ` (critical missing: ${criticalMissing.length}, decor missing: ${decorMissing.length}).`,
                  {
                    issueCount: runtimeData.issues.length,
                    messages: runtimeData.issues,
                    loadOrderPolicy: "shell_critical_decor",
                    criticalMissingCount: criticalMissing.length,
                    criticalMissingIds: criticalMissing,
                    decorMissingCount: decorMissing.length,
                    decorMissingIds: decorMissing
                  },
                  "warning"
                )
              ]
            : [];
        const loadWarnings = [...navWarningIssues, ...assetWarningIssues];
        const status: SceneRuntimeStatus =
          loadWarnings.length > 0 ? "degraded" : "loaded";

        setSnapshot((prev) => ({
          ...prev,
          sceneId: options.sceneId,
          manifestUrl: options.manifestUrl,
          status,
          progress: {
            phase: "complete",
            percent: 100,
            label:
              status === "degraded"
                ? "Loaded with non-fatal validation warnings"
                : "Loaded"
          },
          manifest,
          runtimeData,
          derived: derivedWithRuntime,
          issues: loadWarnings,
          updatedAtMs: Date.now()
        }));
      } catch (error) {
        if (loadToken !== latestLoadTokenRef.current) {
          return;
        }

        if (error instanceof ManifestValidationError) {
          setSnapshot((prev) => ({
            ...prev,
            sceneId: options.sceneId,
            manifestUrl: options.manifestUrl,
            status: "error",
            progress: {
              phase: "failed",
              percent: 100,
              label: "Manifest validation failed"
            },
            manifest: error.manifest,
            runtimeData: null,
            derived: null,
            issues: error.issues,
            updatedAtMs: Date.now()
          }));
          throw error;
        }

        if (error instanceof AssetLoadError) {
          const startupStore = useWorldStore.getState();
          startupStore.beginAssetStartup(1);
          startupStore.markAssetFailed("office_shell", 0, true, error.message);
          const issue = toIssue(
            "asset_loading",
            "asset_load_failed",
            error.message,
            {
              sceneId: options.sceneId,
              manifestUrl: options.manifestUrl
            }
          );
          setSnapshot((prev) => ({
            ...prev,
            sceneId: options.sceneId,
            manifestUrl: options.manifestUrl,
            status: "error",
            progress: {
              phase: "failed",
              percent: 100,
              label: "Asset load failed"
            },
            runtimeData: null,
            issues: [issue],
            updatedAtMs: issue.ts
          }));
          throw error;
        }

        const message =
          error instanceof Error ? error.message : "Unknown manifest fetch failure.";
        const isFetchFailure = message.includes("Failed to fetch scene manifest");
        const issue = toIssue(
          isFetchFailure ? "provider_runtime" : "manifest_validation",
          isFetchFailure ? "manifest_fetch_failed" : "manifest_parse_failed",
          message,
          {
            sceneId: options.sceneId,
            manifestUrl: options.manifestUrl
          }
        );

        setSnapshot((prev) => ({
          ...prev,
          sceneId: options.sceneId,
          manifestUrl: options.manifestUrl,
          status: "error",
          progress: {
            phase: "failed",
            percent: 100,
            label: isFetchFailure ? "Manifest fetch failed" : "Manifest parse failed"
          },
          runtimeData: null,
          derived: null,
          issues: [issue],
          updatedAtMs: issue.ts
        }));

        throw error;
      }
    },
    [fetchManifest, runtimeAssetManager]
  );

  const reloadScene = useCallback(async () => {
    const lastOptions = lastLoadOptionsRef.current;
    if (lastOptions) {
      await loadScene({
        ...lastOptions,
        forceReload: true
      });
      return;
    }

    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot.manifestUrl) {
      return;
    }

    await loadScene({
      sceneId: currentSnapshot.sceneId || DEFAULT_SCENE_ID,
      manifestUrl: currentSnapshot.manifestUrl,
      forceReload: true
    });
  }, [loadScene]);

  const clearIssues = useCallback(() => {
    setSnapshot((prev) => ({
      ...prev,
      issues: [],
      updatedAtMs: Date.now()
    }));
  }, []);

  const getPoi = useCallback(
    (poiId: string) => {
      const fromDerived = snapshotRef.current.derived?.poisById[poiId];
      if (fromDerived) {
        return fromDerived;
      }
      return getPoiFromManifest(snapshotRef.current.manifest, poiId);
    },
    []
  );

  const getObject = useCallback(
    (objectId: string) => {
      const fromDerived = snapshotRef.current.derived?.objectsById[objectId];
      if (fromDerived) {
        return fromDerived;
      }
      return getObjectFromManifest(snapshotRef.current.manifest, objectId);
    },
    []
  );

  const getHighlightNodes = useCallback(
    (poiId: string) => {
      const fromDerived = snapshotRef.current.derived?.poiHighlightNodesById[poiId];
      if (fromDerived) {
        return fromDerived;
      }
      return getHighlightNodesFromManifest(snapshotRef.current.manifest, poiId);
    },
    []
  );

  const getPoiFocusConfig = useCallback((poiId: string) => {
    const fromDerived = snapshotRef.current.derived?.poiFocusConfigById[poiId];
    if (fromDerived) {
      return fromDerived;
    }
    const poi = getPoiFromManifest(snapshotRef.current.manifest, poiId);
    return poi ? focusConfigFromPoi(poi) : null;
  }, []);

  useEffect(() => {
    if (!autoLoad || !initialManifestUrl) {
      return;
    }
    void loadScene({
      sceneId: initialSceneId,
      manifestUrl: initialManifestUrl
    });
  }, [autoLoad, initialManifestUrl, initialSceneId, loadScene]);

  const value = useMemo<SceneRuntimeProviderValue>(
    () => ({
      snapshot,
      loadScene,
      reloadScene,
      clearIssues,
      getPoi,
      getObject,
      getHighlightNodes,
      getPoiFocusConfig
    }),
    [
      clearIssues,
      getHighlightNodes,
      getObject,
      getPoi,
      getPoiFocusConfig,
      loadScene,
      reloadScene,
      snapshot
    ]
  );

  return createElement(SceneRuntimeContext.Provider, { value }, children);
}

export function useSceneRuntimeProvider(): SceneRuntimeProviderValue {
  const context = useContext(SceneRuntimeContext);
  if (!context) {
    throw new Error(
      "SceneRuntimeProvider context missing. Mount provider before consuming runtime scene data."
    );
  }
  return context;
}
