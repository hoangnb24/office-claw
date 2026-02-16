import { create } from "zustand";

export interface PendingPoiAction {
  poiId: string;
  panelId: "inbox" | "task-board" | "artifact-viewer" | null;
  target: [number, number, number];
  interactionRadiusM: number;
}

export interface PlayerNavDebugState {
  navReady: boolean;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  blockedCellCount: number;
  occupiedCellCount: number;
  pathNodeCount: number;
  lastStatus: "idle" | "moving" | "arrived" | "blocked";
  lastReason: string | null;
  startCell: [number, number] | null;
  targetCell: [number, number] | null;
  lastCaptureMode: "anchor" | "collider" | null;
  lastCaptureTarget: string | null;
  lastCapturePoint: [number, number, number] | null;
  lastCaptureSnippet: string | null;
}

interface PlayerStore {
  position: [number, number, number];
  speedMps: number;
  activePath: [number, number, number][];
  pendingPoiAction: PendingPoiAction | null;
  navDebug: PlayerNavDebugState;
  setPosition: (position: [number, number, number]) => void;
  setPath: (path: [number, number, number][], speedMps?: number) => void;
  clearPath: () => void;
  setPendingPoiAction: (action: PendingPoiAction | null) => void;
  setNavDebug: (patch: Partial<PlayerNavDebugState>) => void;
  advanceAlongPath: (deltaSeconds: number) => void;
}

function distance3(a: [number, number, number], b: [number, number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function interpolateToward(
  from: [number, number, number],
  to: [number, number, number],
  distance: number
): [number, number, number] {
  const total = distance3(from, to);
  if (total <= 1e-6) {
    return to;
  }
  const t = Math.min(1, distance / total);
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t
  ];
}

const initialNavDebug: PlayerNavDebugState = {
  navReady: false,
  gridWidth: 0,
  gridHeight: 0,
  cellSize: 0,
  blockedCellCount: 0,
  occupiedCellCount: 0,
  pathNodeCount: 0,
  lastStatus: "idle",
  lastReason: null,
  startCell: null,
  targetCell: null,
  lastCaptureMode: null,
  lastCaptureTarget: null,
  lastCapturePoint: null,
  lastCaptureSnippet: null
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  position: [0, 0, 0],
  speedMps: 2.1,
  activePath: [],
  pendingPoiAction: null,
  navDebug: initialNavDebug,
  setPosition: (position) => set({ position }),
  setPath: (path, speedMps) =>
    set((state) => ({
      activePath: [...path],
      speedMps: speedMps ?? state.speedMps,
      navDebug: {
        ...state.navDebug,
        pathNodeCount: path.length,
        lastStatus: path.length > 0 ? "moving" : "idle",
        lastReason: path.length > 0 ? null : state.navDebug.lastReason
      }
    })),
  clearPath: () =>
    set((state) => ({
      activePath: [],
      navDebug: {
        ...state.navDebug,
        pathNodeCount: 0,
        lastStatus: "idle"
      }
    })),
  setPendingPoiAction: (pendingPoiAction) => set({ pendingPoiAction }),
  setNavDebug: (patch) =>
    set((state) => ({
      navDebug: {
        ...state.navDebug,
        ...patch
      }
    })),
  advanceAlongPath: (deltaSeconds) =>
    set((state) => {
      if (deltaSeconds <= 0 || state.activePath.length === 0) {
        return {};
      }

      let remainingDistance = state.speedMps * deltaSeconds;
      let position = state.position;
      const path = [...state.activePath];

      while (remainingDistance > 0 && path.length > 0) {
        const waypoint = path[0];
        const segmentDistance = distance3(position, waypoint);

        if (segmentDistance <= 1e-6) {
          position = waypoint;
          path.shift();
          continue;
        }

        if (segmentDistance <= remainingDistance) {
          position = waypoint;
          path.shift();
          remainingDistance -= segmentDistance;
          continue;
        }

        position = interpolateToward(position, waypoint, remainingDistance);
        remainingDistance = 0;
      }

      return {
        position,
        activePath: path,
        navDebug: {
          ...state.navDebug,
          pathNodeCount: path.length,
          lastStatus: path.length > 0 ? "moving" : "arrived",
          lastReason: path.length > 0 ? state.navDebug.lastReason : null
        }
      };
    })
}));
