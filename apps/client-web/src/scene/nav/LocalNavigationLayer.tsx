import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import rawSceneManifest from "../highlight/cozy_office_v0.scene.json";
import { parseSceneManifest } from "../loader";
import type { ScenePoi } from "../loader";
import { useInteractionStore } from "../../state/interactionStore";
import {
  usePlayerStore,
  type PendingPoiAction,
  type PlayerNavDebugState
} from "../../state/playerStore";
import { useUiStore } from "../../state/uiStore";
import { useWorldStore } from "../../state/worldStore";
import {
  applyColliderBlockers,
  blockedCellCenters,
  collectColliderBlockedIndices,
  createNavGridRuntime,
  findPathOnGrid,
  validatePoiAnchorReachability,
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
  const navDebugEnabled =
    import.meta.env.DEV ||
    import.meta.env.VITE_NAV_DEBUG === "1" ||
    import.meta.env.VITE_DEBUG_HUD === "1";
  const manifest = useMemo(() => parseSceneManifest(rawSceneManifest), []);
  const baseNavGrid = useMemo(() => createNavGridRuntime(manifest.navigation.grid), [manifest]);
  const colliderBlockers = useMemo(
    () => collectColliderBlockedIndices(manifest, baseNavGrid),
    [baseNavGrid, manifest]
  );
  const navGrid = useMemo(
    () => applyColliderBlockers(baseNavGrid, colliderBlockers.blockedIndices),
    [baseNavGrid, colliderBlockers]
  );
  const anchorValidationIssues = useMemo(
    () => validatePoiAnchorReachability(manifest, navGrid),
    [manifest, navGrid]
  );
  const staticBlockedCellMarkers = useMemo(() => blockedCellCenters(navGrid), [navGrid]);
  const poiById = useMemo(
    () => Object.fromEntries(manifest.pois.map((poi) => [poi.poi_id, poi])),
    [manifest]
  );

  const pendingCommandIntent = useInteractionStore((state) => state.pendingCommandIntent);
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

  useEffect(() => {
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
  }, [anchorValidationIssues]);

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

    const poi = poiById[pendingCommandIntent.sourceId];
    const isPoiCommand =
      Boolean(poi) &&
      (pendingCommandIntent.sourceType === "poi" ||
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
      {navDebugEnabled && debugHudEnabled && showBlockedCellsOverlay
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
