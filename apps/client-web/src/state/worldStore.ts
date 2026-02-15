import { create } from "zustand";

export type AgentState = "idle" | "walking" | "working" | "meeting" | "blocked";
export type AgentGoalKind =
  | "go_to_poi"
  | "go_to_player"
  | "wait"
  | "deliver_artifact"
  | "seek_decision";
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "stale"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface AgentSnapshot {
  id: string;
  pos: [number, number, number];
  state: AgentState;
  taskId?: string;
}

export interface AgentGoal {
  goalId: string;
  kind: AgentGoalKind;
  path: [number, number, number][];
  speedMps: number;
  arrivalRadius: number;
}

export type TaskStatus = "planned" | "in_progress" | "blocked" | "done" | "cancelled";

export interface TaskSnapshot {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assignee?: string;
}

export interface WorldEvent {
  id: string;
  ts: number;
  seq: number | null;
  name: string;
  projectId: string;
  taskId?: string;
  artifactId?: string;
  decisionId?: string;
  poiId?: string;
  agentId?: string;
  participants: string[];
  meta?: Record<string, unknown>;
}

export interface AssetStartupState {
  total: number;
  loaded: number;
  failed: number;
  criticalFailed: number;
  inProgress: boolean;
  lastError: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  durationMs: number | null;
  slowestAssetId: string | null;
  slowestAssetMs: number | null;
}

export interface RuntimePerfMetrics {
  fps: number | null;
  frameAvgMs: number | null;
  frameP95Ms: number | null;
  frameHotspotCount: number;
  frameSampleCount: number;
  hotspotPercent: number;
  drawCalls: number | null;
  triangles: number | null;
  lines: number | null;
  points: number | null;
  alertLevel: "healthy" | "warning" | "critical";
  alerts: string[];
  lastUpdatedMs: number | null;
}

interface WorldStore {
  sceneId: string | null;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  lastConnectionError: string | null;
  lastSeq: number | null;
  lastSnapshotId: string | null;
  assetStartup: AssetStartupState;
  runtimePerf: RuntimePerfMetrics;
  agents: Record<string, AgentSnapshot>;
  agentGoals: Record<string, AgentGoal>;
  events: WorldEvent[];
  tasks: Record<string, TaskSnapshot>;
  pendingTaskAssignments: Record<
    string,
    {
      taskId: string;
      previousAssignee: string | null;
      nextAssignee: string;
    }
  >;
  setScene: (sceneId: string) => void;
  setConnectionState: (
    status: ConnectionStatus,
    options?: {
      reconnectAttempt?: number;
      error?: string | null;
    }
  ) => void;
  setResumeCursor: (cursor: { lastSeq?: number | null; lastSnapshotId?: string | null }) => void;
  beginAssetStartup: (total: number) => void;
  markAssetLoaded: (assetId: string, durationMs: number) => void;
  markAssetFailed: (assetId: string, durationMs: number, isCritical: boolean, error: string) => void;
  setRuntimePerf: (patch: Partial<RuntimePerfMetrics>) => void;
  upsertAgent: (agent: AgentSnapshot) => void;
  upsertAgentGoal: (agentId: string, goal: AgentGoal) => void;
  appendEvent: (event: WorldEvent) => void;
  replaceTasks: (tasks: TaskSnapshot[]) => void;
  bootstrapOfflineState: (payload: {
    agents: AgentSnapshot[];
    goals?: Array<{ agentId: string; goal: AgentGoal }>;
    tasks: TaskSnapshot[];
    events: WorldEvent[];
    lastSeq?: number | null;
    lastSnapshotId?: string | null;
  }) => void;
  applyOptimisticTaskAssignment: (taskId: string, assignee: string, commandId: string) => void;
  resolveOptimisticTaskAssignment: (commandId: string, success: boolean) => void;
}

const MAX_EVENT_FEED_ITEMS = 120;

const initialRuntimePerf: RuntimePerfMetrics = {
  fps: null,
  frameAvgMs: null,
  frameP95Ms: null,
  frameHotspotCount: 0,
  frameSampleCount: 0,
  hotspotPercent: 0,
  drawCalls: null,
  triangles: null,
  lines: null,
  points: null,
  alertLevel: "healthy",
  alerts: [],
  lastUpdatedMs: null
};

export const useWorldStore = create<WorldStore>((set) => ({
  sceneId: null,
  connected: false,
  connectionStatus: "idle",
  reconnectAttempt: 0,
  lastConnectionError: null,
  lastSeq: null,
  lastSnapshotId: null,
  assetStartup: {
    total: 0,
    loaded: 0,
    failed: 0,
    criticalFailed: 0,
    inProgress: false,
    lastError: null,
    startedAtMs: null,
    completedAtMs: null,
    durationMs: null,
    slowestAssetId: null,
    slowestAssetMs: null
  },
  runtimePerf: initialRuntimePerf,
  agents: {},
  agentGoals: {},
  events: [],
  tasks: {},
  pendingTaskAssignments: {},
  setScene: (sceneId) => set({ sceneId }),
  setConnectionState: (status, options) =>
    set((state) => ({
      connectionStatus: status,
      connected: status === "connected",
      reconnectAttempt: options?.reconnectAttempt ?? state.reconnectAttempt,
      lastConnectionError:
        options && Object.prototype.hasOwnProperty.call(options, "error")
          ? options.error ?? null
          : state.lastConnectionError
    })),
  setResumeCursor: (cursor) =>
    set((state) => ({
      lastSeq:
        cursor.lastSeq !== undefined
          ? cursor.lastSeq
          : state.lastSeq,
      lastSnapshotId:
        cursor.lastSnapshotId !== undefined
          ? cursor.lastSnapshotId
          : state.lastSnapshotId
    })),
  beginAssetStartup: (total) =>
    {
      const startedAtMs = Date.now();
      return set({
        assetStartup: {
          total,
          loaded: 0,
          failed: 0,
          criticalFailed: 0,
          inProgress: total > 0,
          lastError: null,
          startedAtMs,
          completedAtMs: total > 0 ? null : startedAtMs,
          durationMs: total > 0 ? null : 0,
          slowestAssetId: null,
          slowestAssetMs: null
        }
      });
    },
  markAssetLoaded: (assetId, durationMs) =>
    set((state) => {
      const nextLoaded = state.assetStartup.loaded + 1;
      const done = nextLoaded + state.assetStartup.failed >= state.assetStartup.total;
      const nextSlowestAssetMs = Math.max(state.assetStartup.slowestAssetMs ?? 0, durationMs);
      const nextSlowestAssetId =
        state.assetStartup.slowestAssetMs === null || durationMs >= state.assetStartup.slowestAssetMs
          ? assetId
          : state.assetStartup.slowestAssetId;
      const completedAtMs = done ? Date.now() : state.assetStartup.completedAtMs;
      const durationFromStartup =
        done && state.assetStartup.startedAtMs !== null && completedAtMs !== null
          ? Math.max(0, completedAtMs - state.assetStartup.startedAtMs)
          : state.assetStartup.durationMs;
      return {
        assetStartup: {
          ...state.assetStartup,
          loaded: nextLoaded,
          inProgress: !done,
          completedAtMs,
          durationMs: durationFromStartup,
          slowestAssetId: nextSlowestAssetId,
          slowestAssetMs: nextSlowestAssetMs
        }
      };
    }),
  markAssetFailed: (assetId, durationMs, isCritical, error) =>
    set((state) => {
      const nextFailed = state.assetStartup.failed + 1;
      const nextCriticalFailed = state.assetStartup.criticalFailed + (isCritical ? 1 : 0);
      const done = state.assetStartup.loaded + nextFailed >= state.assetStartup.total;
      const nextSlowestAssetMs = Math.max(state.assetStartup.slowestAssetMs ?? 0, durationMs);
      const nextSlowestAssetId =
        state.assetStartup.slowestAssetMs === null || durationMs >= state.assetStartup.slowestAssetMs
          ? assetId
          : state.assetStartup.slowestAssetId;
      const completedAtMs = done ? Date.now() : state.assetStartup.completedAtMs;
      const durationFromStartup =
        done && state.assetStartup.startedAtMs !== null && completedAtMs !== null
          ? Math.max(0, completedAtMs - state.assetStartup.startedAtMs)
          : state.assetStartup.durationMs;
      return {
        assetStartup: {
          ...state.assetStartup,
          failed: nextFailed,
          criticalFailed: nextCriticalFailed,
          inProgress: !done,
          lastError: error,
          completedAtMs,
          durationMs: durationFromStartup,
          slowestAssetId: nextSlowestAssetId,
          slowestAssetMs: nextSlowestAssetMs
        }
      };
    }),
  setRuntimePerf: (patch) =>
    set((state) => ({
      runtimePerf: {
        ...state.runtimePerf,
        ...patch
      }
    })),
  upsertAgent: (agent) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.id]: agent
      }
    })),
  upsertAgentGoal: (agentId, goal) =>
    set((state) => ({
      agentGoals: {
        ...state.agentGoals,
        [agentId]: goal
      }
    })),
  appendEvent: (event) =>
    set((state) => {
      if (state.events.some((item) => item.id === event.id)) {
        return state;
      }
      const next = [...state.events, event];
      const overflow = next.length - MAX_EVENT_FEED_ITEMS;
      return {
        events: overflow > 0 ? next.slice(overflow) : next
      };
    }),
  replaceTasks: (tasks) =>
    set((state) => {
      const nextTasks = Object.fromEntries(tasks.map((task) => [task.id, task]));
      for (const pending of Object.values(state.pendingTaskAssignments)) {
        const task = nextTasks[pending.taskId];
        if (!task) {
          continue;
        }
        nextTasks[pending.taskId] = {
          ...task,
          assignee: pending.nextAssignee
        };
      }
      return { tasks: nextTasks };
    }),
  bootstrapOfflineState: ({ agents, goals = [], tasks, events, lastSeq = null, lastSnapshotId = null }) =>
    set(() => ({
      connected: true,
      connectionStatus: "connected",
      reconnectAttempt: 0,
      lastConnectionError: null,
      lastSeq,
      lastSnapshotId,
      agents: Object.fromEntries(agents.map((agent) => [agent.id, agent])),
      agentGoals: Object.fromEntries(goals.map((item) => [item.agentId, item.goal])),
      tasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
      events: events.slice(Math.max(0, events.length - MAX_EVENT_FEED_ITEMS)),
      pendingTaskAssignments: {}
    })),
  applyOptimisticTaskAssignment: (taskId, assignee, commandId) =>
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) {
        return state;
      }
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            assignee
          }
        },
        pendingTaskAssignments: {
          ...state.pendingTaskAssignments,
          [commandId]: {
            taskId,
            previousAssignee: task.assignee ?? null,
            nextAssignee: assignee
          }
        }
      };
    }),
  resolveOptimisticTaskAssignment: (commandId, success) =>
    set((state) => {
      const pending = state.pendingTaskAssignments[commandId];
      if (!pending) {
        return state;
      }

      const nextPending = { ...state.pendingTaskAssignments };
      delete nextPending[commandId];

      if (success) {
        return {
          pendingTaskAssignments: nextPending
        };
      }

      const task = state.tasks[pending.taskId];
      if (!task) {
        return {
          pendingTaskAssignments: nextPending
        };
      }

      return {
        tasks: {
          ...state.tasks,
          [pending.taskId]: {
            ...task,
            assignee: pending.previousAssignee ?? undefined
          }
        },
        pendingTaskAssignments: nextPending
      };
    })
}));
