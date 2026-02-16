import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo } from "react";
import type { SceneManifest, ScenePoi } from "../loader";
import { useSceneRuntimeProvider } from "../runtime";
import { useInteractionStore, type InteractionTargetType } from "../../state/interactionStore";
import {
  usePlayerStore,
  type PendingPoiAction,
  type PlayerNavDebugState
} from "../../state/playerStore";
import { useUiStore } from "../../state/uiStore";
import { useWorldStore } from "../../state/worldStore";
import {
  blockedCellCenters,
  findPathOnGrid,
  type NavGridRuntime
} from "./pathfinding";

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coord) => typeof coord === "number" && Number.isFinite(coord))
  );
}

function distanceXZ(a: [number, number, number], b: [number, number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function panelFromToken(token: string | undefined): PendingPoiAction["panelId"] {
  if (!token) {
    return null;
  }

  const normalized = token.trim().toLowerCase();
  if (normalized === "inbox") {
    return "inbox";
  }
  if (normalized === "task_board" || normalized === "task-board") {
    return "task-board";
  }
  if (normalized === "deliverables" || normalized === "artifact_viewer" || normalized === "artifact-viewer") {
    return "artifact-viewer";
  }
  return null;
}

function panelFromIntent(commandName: string, poi: ScenePoi): PendingPoiAction["panelId"] {
  const manifestPanel = panelFromToken(poi.interaction?.panel);
  if (manifestPanel) {
    return manifestPanel;
  }

  // Compatibility fallback for legacy command-name routing while manifests
  // are being normalized to panel-first metadata.
  if (commandName === "open_inbox_panel") {
    return "inbox";
  }
  if (commandName === "open_task_board_panel") {
    return "task-board";
  }
  if (commandName === "open_deliverables_panel") {
    return "artifact-viewer";
  }
  return panelFromToken(poi.interaction?.panel);
}

function pushPoiInteractionFeedback(poi: ScenePoi, panelId: PendingPoiAction["panelId"]) {
  const ui = useUiStore.getState();
  const poiLabel = poi.poi_id.replace(/^poi_/, "").replace(/_/g, " ");

  if (panelId === "inbox") {
    ui.setInboxNotice({
      level: "success",
      message: `Inbox interaction ready at ${poiLabel}.`
    });
    return;
  }
  if (panelId === "task-board") {
    ui.setTaskBoardNotice({
      level: "success",
      message: `Task Board interaction ready at ${poiLabel}.`
    });
    return;
  }
  if (panelId === "artifact-viewer") {
    ui.setArtifactNotice({
      level: "success",
      message: `Delivery interaction ready at ${poiLabel}.`
    });
  }
}

interface NavAuthoringCapture {
  mode: "anchor" | "collider";
  target: string;
  point: [number, number, number];
  snippet: string;
}

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

function roundedVec3(vec: [number, number, number]): [number, number, number] {
  return [rounded(vec[0]), rounded(vec[1]), rounded(vec[2])];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
}

function buildAnchorCapture(
  manifest: SceneManifest,
  poiId: string,
  point: [number, number, number]
): NavAuthoringCapture | null {
  const poiIndex = manifest.pois.findIndex((poi) => poi.poi_id === poiId);
  if (poiIndex < 0) {
    return null;
  }

  const poi = manifest.pois[poiIndex];
  if (!Array.isArray(poi.nav_anchors) || poi.nav_anchors.length === 0) {
    return null;
  }

  const anchorIndex = 0;
  const anchor = poi.nav_anchors[anchorIndex];
  const capturePoint = roundedVec3(point);
  const patchPayload = {
    capture_kind: "poi_anchor",
    poi_id: poi.poi_id,
    anchor_id: anchor.id,
    captured_world_pos: capturePoint,
    json_patch: [
      {
        op: "replace",
        path: `/pois/${poiIndex}/nav_anchors/${anchorIndex}/pos`,
        value: capturePoint
      }
    ]
  };

  return {
    mode: "anchor",
    target: `poi:${poi.poi_id}/anchor:${anchor.id}`,
    point: capturePoint,
    snippet: JSON.stringify(patchPayload, null, 2)
  };
}

function buildColliderCapture(
  manifest: SceneManifest,
  targetType: InteractionTargetType | null,
  targetId: string | null,
  point: [number, number, number]
): NavAuthoringCapture | null {
  if (!targetId) {
    return null;
  }

  let objectIndex = -1;
  if (targetType === "object") {
    objectIndex = manifest.objects.findIndex((object) => object.id === targetId);
  } else if (targetType === "poi") {
    objectIndex = manifest.objects.findIndex((object) => object.poi_id === targetId);
  }

  if (objectIndex < 0) {
    return null;
  }

  const object = manifest.objects[objectIndex];
  const objectPosY = object.transform?.pos?.[1] ?? point[1] ?? 0;
  const snappedPosition: [number, number, number] = [
    rounded(point[0]),
    rounded(objectPosY),
    rounded(point[2])
  ];

  const patchPayload = {
    capture_kind: "object_collider",
    object_id: object.id,
    poi_id: object.poi_id ?? null,
    captured_world_pos: snappedPosition,
    json_patch: [
      {
        op: "replace",
        path: `/objects/${objectIndex}/transform/pos`,
        value: snappedPosition
      }
    ]
  };

  return {
    mode: "collider",
    target: `object:${object.id}`,
    point: snappedPosition,
    snippet: JSON.stringify(patchPayload, null, 2)
  };
}

function applyPathIntent(
  navGrid: NavGridRuntime,
  start: [number, number, number],
  target: [number, number, number],
  occupiedWorldPositions: [number, number, number][],
  setPath: (path: [number, number, number][], speedMps?: number) => void,
  setNavDebug: (patch: Partial<PlayerNavDebugState>) => void
): boolean {
  const pathResult = findPathOnGrid(navGrid, start, target, {
    occupiedWorldPositions,
    y: start[1]
  });

  if (!pathResult) {
    setNavDebug({
      lastStatus: "blocked",
      lastReason: "no_path_found",
      pathNodeCount: 0
    });
    return false;
  }

  setPath(pathResult.path);
  setNavDebug({
    lastStatus: "moving",
    lastReason: null,
    pathNodeCount: pathResult.path.length,
    occupiedCellCount: pathResult.occupiedCellCount,
    startCell: [pathResult.startCell.col, pathResult.startCell.row],
    targetCell: [pathResult.targetCell.col, pathResult.targetCell.row]
  });
  return true;
}

export function LocalNavigationLayer() {
  const { snapshot, reloadScene } = useSceneRuntimeProvider();
  const navDebugEnabled =
    import.meta.env.DEV ||
    import.meta.env.VITE_NAV_DEBUG === "1" ||
    import.meta.env.VITE_DEBUG_HUD === "1";

  const manifest = snapshot.manifest;
  const navGrid = snapshot.derived?.navigationGrid ?? null;
  const anchorValidationIssues = snapshot.derived?.navAnchorIssues ?? [];
  const staticBlockedCellMarkers = useMemo(
    () => (navGrid ? blockedCellCenters(navGrid) : []),
    [navGrid]
  );
  const poiById = snapshot.derived?.poisById ?? {};
  const sceneId = snapshot.sceneId || manifest?.scene_id || "cozy_office_v0";

  const pendingCommandIntent = useInteractionStore((state) => state.pendingCommandIntent);
  const pointerWorldPos = useInteractionStore((state) => state.pointerWorldPos);
  const hoveredId = useInteractionStore((state) => state.hoveredId);
  const hoveredType = useInteractionStore((state) => state.hoveredType);
  const selectedId = useInteractionStore((state) => state.selectedId);
  const selectedType = useInteractionStore((state) => state.selectedType);
  const clearCommandIntent = useInteractionStore((state) => state.clearCommandIntent);

  const openPanel = useUiStore((state) => state.openPanel);
  const setFocusedPoi = useUiStore((state) => state.setFocusedPoi);
  const setFocusedAgent = useUiStore((state) => state.setFocusedAgent);
  const debugHudEnabled = useUiStore((state) => state.debugHudEnabled);
  const showPathOverlay = useUiStore((state) => state.showPathOverlay);
  const showBlockedCellsOverlay = useUiStore((state) => state.showBlockedCellsOverlay);
  const showAnchorIssueOverlay = useUiStore((state) => state.showAnchorIssueOverlay);

  const occupiedWorldPositions = useWorldStore((state) =>
    Object.values(state.agents).map((agent) => agent.pos)
  );

  const playerPosition = usePlayerStore((state) => state.position);
  const activePath = usePlayerStore((state) => state.activePath);
  const setPosition = usePlayerStore((state) => state.setPosition);
  const setPath = usePlayerStore((state) => state.setPath);
  const clearPath = usePlayerStore((state) => state.clearPath);
  const setPendingPoiAction = usePlayerStore((state) => state.setPendingPoiAction);
  const setNavDebug = usePlayerStore((state) => state.setNavDebug);
  const advanceAlongPath = usePlayerStore((state) => state.advanceAlongPath);

  const reloadManifest = useCallback(async () => {
    try {
      await reloadScene();
      setNavDebug({
        lastStatus: "idle",
        lastReason: "manifest_hot_reload_ok"
      });
      console.info(`[nav-authoring] manifest reloaded for ${sceneId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown manifest reload failure";
      setNavDebug({
        lastStatus: "blocked",
        lastReason: "manifest_hot_reload_failed"
      });
      console.warn(`[nav-authoring] manifest reload failed: ${message}`);
    }
  }, [reloadScene, sceneId, setNavDebug]);

  useEffect(() => {
    if (!manifest || !navGrid) {
      setNavDebug({
        navReady: false,
        gridWidth: 0,
        gridHeight: 0,
        cellSize: 0,
        blockedCellCount: 0
      });
      return;
    }

    const spawn = manifest.spawns?.player ?? [0, 0, 0];
    setPosition(spawn);
    setNavDebug({
      navReady: true,
      gridWidth: navGrid.width,
      gridHeight: navGrid.height,
      cellSize: navGrid.cellSize,
      blockedCellCount: navGrid.blockedCellCount,
      lastStatus: "idle",
      lastReason: null
    });
  }, [manifest, navGrid, setNavDebug, setPosition]);

  useEffect(() => {
    if (!navDebugEnabled || !debugHudEnabled) {
      return;
    }
    if (anchorValidationIssues.length === 0) {
      return;
    }
    for (const issue of anchorValidationIssues) {
      const nearest =
        issue.nearestWalkableCell
          ? ` nearest=(${issue.nearestWalkableCell.col},${issue.nearestWalkableCell.row})`
          : "";
      console.warn(
        `[nav] anchor issue ${issue.reason} poi=${issue.poiId} anchor=${issue.anchorId}${nearest}`
      );
    }
  }, [anchorValidationIssues, debugHudEnabled, navDebugEnabled]);

  useEffect(() => {
    if (!navDebugEnabled || !debugHudEnabled) {
      return;
    }

    const handleCaptureKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }
      const normalizedKey = event.key.toLowerCase();

      if (normalizedKey === "r") {
        void reloadManifest();
        event.preventDefault();
        return;
      }

      if (normalizedKey !== "c") {
        return;
      }
      if (!pointerWorldPos || !manifest) {
        return;
      }

      const captureTargetId = selectedId ?? hoveredId;
      const captureTargetType = selectedType ?? hoveredType;
      const capture = event.shiftKey
        ? buildColliderCapture(manifest, captureTargetType, captureTargetId, pointerWorldPos)
        : captureTargetType === "poi" && captureTargetId
          ? buildAnchorCapture(manifest, captureTargetId, pointerWorldPos)
          : null;

      if (!capture) {
        const modeLabel = event.shiftKey ? "collider" : "anchor";
        console.warn(
          `[nav-authoring] ${modeLabel} capture requires a ${event.shiftKey ? "POI/object" : "POI"} target under pointer.`
        );
        return;
      }

      setNavDebug({
        lastCaptureMode: capture.mode,
        lastCaptureTarget: capture.target,
        lastCapturePoint: capture.point,
        lastCaptureSnippet: capture.snippet
      });

      console.info(`[nav-authoring] capture ${capture.mode} ${capture.target}\n${capture.snippet}`);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(capture.snippet).catch(() => {
          // no-op: clipboard availability depends on browser permissions/context
        });
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", handleCaptureKeyDown);
    return () => {
      window.removeEventListener("keydown", handleCaptureKeyDown);
    };
  }, [
    debugHudEnabled,
    hoveredId,
    hoveredType,
    manifest,
    navDebugEnabled,
    pointerWorldPos,
    reloadManifest,
    selectedId,
    selectedType,
    setNavDebug
  ]);

  useEffect(() => {
    if (!pendingCommandIntent) {
      return;
    }

    const currentPlayerPosition = usePlayerStore.getState().position;

    if (pendingCommandIntent.name === "open_agent_inspector" && pendingCommandIntent.sourceType === "agent") {
      setFocusedAgent(pendingCommandIntent.sourceId);
      openPanel("agent-inspector");
      clearCommandIntent();
      return;
    }

    if (!navGrid) {
      setNavDebug({
        lastStatus: "blocked",
        lastReason: "nav_grid_unavailable"
      });
      clearCommandIntent();
      return;
    }

    const poi = poiById[pendingCommandIntent.sourceId];
    const isPoiCommand =
      Boolean(poi) &&
      (pendingCommandIntent.sourceType === "poi" ||
        pendingCommandIntent.sourceType === "artifact" ||
        pendingCommandIntent.name === "focus_poi" ||
        pendingCommandIntent.name.startsWith("open_"));

    if (poi && isPoiCommand) {
      const anchor = poi.nav_anchors[0]?.pos ?? currentPlayerPosition;
      const interactionRadiusM = poi.interaction_radius_m ?? 1.25;
      const panelId = panelFromIntent(pendingCommandIntent.name, poi);

      setFocusedPoi(poi.poi_id);
      if (distanceXZ(currentPlayerPosition, anchor) <= interactionRadiusM) {
        if (panelId) {
          openPanel(panelId);
          pushPoiInteractionFeedback(poi, panelId);
        }
        setPendingPoiAction(null);
        setNavDebug({
          lastStatus: "arrived",
          lastReason: null,
          pathNodeCount: 0
        });
        clearCommandIntent();
        return;
      }

      const pathFound = applyPathIntent(
        navGrid,
        currentPlayerPosition,
        anchor,
        occupiedWorldPositions,
        setPath,
        setNavDebug
      );
      if (pathFound) {
        setPendingPoiAction({
          poiId: poi.poi_id,
          panelId,
          target: anchor,
          interactionRadiusM
        });
      }
      clearCommandIntent();
      return;
    }

    const clickPoint = pendingCommandIntent.payload?.point;
    if (isVec3(clickPoint)) {
      setPendingPoiAction(null);
      applyPathIntent(
        navGrid,
        currentPlayerPosition,
        clickPoint,
        occupiedWorldPositions,
        setPath,
        setNavDebug
      );
    }

    clearCommandIntent();
  }, [
    clearCommandIntent,
    navGrid,
    occupiedWorldPositions,
    openPanel,
    pendingCommandIntent,
    poiById,
    setFocusedAgent,
    setFocusedPoi,
    setNavDebug,
    setPath,
    setPendingPoiAction
  ]);

  useFrame((_, delta) => {
    advanceAlongPath(delta);
    const state = usePlayerStore.getState();
    const pendingPoiAction = state.pendingPoiAction;
    if (!pendingPoiAction) {
      return;
    }

    const distance = distanceXZ(state.position, pendingPoiAction.target);
    if (distance <= pendingPoiAction.interactionRadiusM) {
      state.setPendingPoiAction(null);
      clearPath();
      setFocusedPoi(pendingPoiAction.poiId);
      if (pendingPoiAction.panelId) {
        openPanel(pendingPoiAction.panelId);
        const pendingPoi = poiById[pendingPoiAction.poiId];
        if (pendingPoi) {
          pushPoiInteractionFeedback(pendingPoi, pendingPoiAction.panelId);
        }
      }
      setNavDebug({
        lastStatus: "arrived",
        lastReason: null
      });
      return;
    }

    if (state.activePath.length === 0) {
      state.setPendingPoiAction(null);
      setNavDebug({
        lastStatus: "blocked",
        lastReason: "path_ended_before_reaching_poi_radius"
      });
    }
  });

  return (
    <group>
      <mesh position={[playerPosition[0], playerPosition[1] + 0.14, playerPosition[2]]}>
        <cylinderGeometry args={[0.13, 0.16, 0.28, 14]} />
        <meshStandardMaterial color="#6be3ff" emissive="#2d88a1" emissiveIntensity={0.6} />
      </mesh>
      {navDebugEnabled && debugHudEnabled && showPathOverlay
        ? activePath.map((waypoint, index) => (
            <mesh
              key={`local-path-node-${index}-${waypoint[0].toFixed(3)}-${waypoint[2].toFixed(3)}`}
              position={[waypoint[0], waypoint[1] + 0.025, waypoint[2]]}
            >
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color="#4ce38f" emissive="#2ea766" emissiveIntensity={0.5} />
            </mesh>
          ))
        : null}
      {navDebugEnabled && debugHudEnabled && showBlockedCellsOverlay && navGrid
        ? staticBlockedCellMarkers.map((position, index) => (
            <mesh key={`blocked-cell-${index}`} position={position}>
              <boxGeometry args={[navGrid.cellSize * 0.82, 0.04, navGrid.cellSize * 0.82]} />
              <meshStandardMaterial color="#d45b5b" emissive="#7a2a2a" emissiveIntensity={0.4} />
            </mesh>
          ))
        : null}
      {navDebugEnabled && debugHudEnabled && showAnchorIssueOverlay
        ? anchorValidationIssues.map((issue) => (
            <mesh
              key={`anchor-issue-${issue.poiId}-${issue.anchorId}`}
              position={[issue.anchorPos[0], issue.anchorPos[1] + 0.12, issue.anchorPos[2]]}
            >
              <sphereGeometry args={[0.08, 10, 10]} />
              <meshStandardMaterial color="#ffe58a" emissive="#c97a0e" emissiveIntensity={0.7} />
            </mesh>
          ))
        : null}
    </group>
  );
}
