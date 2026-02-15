import { useEffect, useRef } from "react";
import { WorldSocketClient } from "./worldSocketClient";
import { taskBoardErrorMicrocopy } from "./taskBoardCommands";
import { inboxErrorMicrocopy } from "./inboxCommands";
import { decisionErrorMicrocopy } from "./decisionCommands";
import { artifactErrorMicrocopy } from "./artifactCommands";
import { overrideErrorMicrocopy } from "./overrideCommands";
import { setWorldSocketClient } from "./worldSocketBridge";
import {
  isOfflineMockWorldEnabled,
  shouldAutoConnectWorldSocket,
  worldSocketUrl
} from "../config/runtimeProfile";
import { createOfflineMockWorldRuntime } from "../offline/mockWorldRuntime";
import {
  useWorldStore,
  type AgentGoal,
  type WorldEvent,
  type TaskSnapshot,
  type TaskStatus,
  type AgentGoalKind,
  type AgentSnapshot,
  type AgentState
} from "../state/worldStore";
import {
  useUiStore,
  type ArtifactSnapshot,
  type ArtifactStatus,
  type DecisionSnapshot,
  type BdChatMessage
} from "../state/uiStore";

interface Envelope {
  type?: string;
  id?: string;
  ts?: number;
  payload?: Record<string, unknown>;
}

const AGENT_GOAL_KINDS: AgentGoalKind[] = [
  "go_to_poi",
  "go_to_player",
  "wait",
  "deliver_artifact",
  "seek_decision"
];

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coord) => typeof coord === "number" && Number.isFinite(coord))
  );
}

function normalizeAgentState(value: unknown): AgentState | null {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim().toLowerCase();
  if (!token) {
    return null;
  }
  if (token.includes("walk")) {
    return "walking";
  }
  if (token.includes("work")) {
    return "working";
  }
  if (token.includes("meet")) {
    return "meeting";
  }
  if (token.includes("block")) {
    return "blocked";
  }
  return "idle";
}

function parseAgentSnapshot(value: unknown): AgentSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : candidate.agent_id;
  const state = normalizeAgentState(candidate.state);
  if (typeof id !== "string" || !isVec3(candidate.pos) || !state) {
    return null;
  }

  const taskIdCandidate =
    typeof candidate.task_id === "string"
      ? candidate.task_id
      : typeof candidate.taskId === "string"
        ? candidate.taskId
        : undefined;

  return {
    id,
    pos: candidate.pos,
    state,
    taskId: taskIdCandidate
  };
}

function isPath(value: unknown): value is [number, number, number][] {
  return Array.isArray(value) && value.every((point) => isVec3(point));
}

function parseAgentGoal(envelope: Envelope): { agentId: string; goal: AgentGoal } | null {
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const agentId = payload.agent_id;
  const goal = payload.goal;
  const path = payload.path;
  const speedMps = payload.speed_mps;
  const arrivalRadius = payload.arrival_radius;

  if (
    typeof agentId !== "string" ||
    typeof goal !== "object" ||
    goal === null ||
    !isPath(path) ||
    typeof speedMps !== "number" ||
    !Number.isFinite(speedMps) ||
    speedMps <= 0 ||
    typeof arrivalRadius !== "number" ||
    !Number.isFinite(arrivalRadius) ||
    arrivalRadius <= 0
  ) {
    return null;
  }

  const goalKind = (goal as Record<string, unknown>).kind;
  if (typeof goalKind !== "string" || !AGENT_GOAL_KINDS.includes(goalKind as AgentGoalKind)) {
    return null;
  }

  return {
    agentId,
    goal: {
      goalId: envelope.id ?? `goal_${agentId}_${Date.now()}`,
      kind: goalKind as AgentGoalKind,
      path,
      speedMps,
      arrivalRadius
    }
  };
}

const TASK_STATUSES: TaskStatus[] = ["planned", "in_progress", "blocked", "done", "cancelled"];
const ARTIFACT_STATUSES: ArtifactStatus[] = [
  "created",
  "delivered",
  "in_review",
  "approved",
  "changes_requested",
  "superseded",
  "archived"
];

function parseTaskSnapshot(value: unknown): TaskSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = candidate.task_id;
  const projectId = candidate.project_id;
  const title = candidate.title;
  const status = candidate.status;

  if (
    typeof id !== "string" ||
    typeof projectId !== "string" ||
    typeof title !== "string" ||
    typeof status !== "string" ||
    !TASK_STATUSES.includes(status as TaskStatus)
  ) {
    return null;
  }

  return {
    id,
    projectId,
    title,
    status: status as TaskStatus,
    assignee: typeof candidate.assignee === "string" ? candidate.assignee : undefined
  };
}

function normalizeArtifactStatus(value: unknown): ArtifactStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim().toLowerCase();
  if (!token) {
    return null;
  }
  return ARTIFACT_STATUSES.includes(token as ArtifactStatus) ? (token as ArtifactStatus) : null;
}

function parseArtifactSnapshot(value: unknown): ArtifactSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const artifactId = candidate.artifact_id;
  const projectId = candidate.project_id;
  const type = candidate.type;
  const status = normalizeArtifactStatus(candidate.status);
  const version = typeof candidate.version === "number" ? candidate.version : Number.NaN;

  if (
    typeof artifactId !== "string" ||
    typeof projectId !== "string" ||
    typeof type !== "string" ||
    !status ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return null;
  }

  return {
    artifactId,
    projectId,
    type,
    status,
    version,
    taskId: typeof candidate.task_id === "string" ? candidate.task_id : undefined,
    poiId: typeof candidate.poi_id === "string" ? candidate.poi_id : undefined,
    updatedTs:
      typeof candidate.updated_ts === "number" && Number.isFinite(candidate.updated_ts)
        ? candidate.updated_ts
        : Date.now()
  };
}

function parseWorldEvent(envelope: Envelope): WorldEvent | null {
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const name = payload.name;
  const projectId = payload.project_id;
  if (typeof name !== "string" || typeof projectId !== "string") {
    return null;
  }

  const participants = Array.isArray(payload.participants)
    ? payload.participants.filter((item): item is string => typeof item === "string")
    : [];

  const seq = typeof payload.seq === "number" ? payload.seq : null;

  return {
    id: envelope.id ?? `event_${name}_${Date.now()}`,
    ts: typeof envelope.ts === "number" ? envelope.ts : Date.now(),
    seq,
    name,
    projectId,
    taskId: typeof payload.task_id === "string" ? payload.task_id : undefined,
    artifactId: typeof payload.artifact_id === "string" ? payload.artifact_id : undefined,
    decisionId: typeof payload.decision_id === "string" ? payload.decision_id : undefined,
    poiId: typeof payload.poi_id === "string" ? payload.poi_id : undefined,
    agentId: typeof payload.agent_id === "string" ? payload.agent_id : undefined,
    participants,
    meta:
      payload.meta && typeof payload.meta === "object"
        ? (payload.meta as Record<string, unknown>)
        : undefined
  };
}

function artifactStatusFromEvent(event: WorldEvent): ArtifactStatus | null {
  const fromMeta = normalizeArtifactStatus(event.meta?.artifact_status);
  if (fromMeta) {
    return fromMeta;
  }
  switch (event.name) {
    case "artifact_created":
      return "created";
    case "artifact_delivered":
      return "delivered";
    case "review_approved":
      return "approved";
    case "review_changes_requested":
      return "changes_requested";
    default:
      return null;
  }
}

function normalizeDecisionStatus(value: unknown): "open" | "resolved" | null {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim().toLowerCase();
  if (!token) {
    return null;
  }
  if (token.includes("resolv")) {
    return "resolved";
  }
  if (token.includes("open")) {
    return "open";
  }
  return null;
}

function parseDecisionSnapshot(value: unknown): DecisionSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const decisionId = candidate.decision_id;
  const projectId = candidate.project_id;
  const status = normalizeDecisionStatus(candidate.status);

  if (typeof decisionId !== "string" || typeof projectId !== "string" || !status) {
    return null;
  }

  const promptCandidate =
    typeof candidate.prompt === "string" && candidate.prompt.trim()
      ? candidate.prompt
      : "Decision pending";

  return {
    decisionId,
    projectId,
    taskId: typeof candidate.task_id === "string" ? candidate.task_id : undefined,
    prompt: promptCandidate,
    status,
    choice: typeof candidate.choice === "string" ? candidate.choice : undefined,
    updatedTs:
      typeof candidate.updated_ts === "number" && Number.isFinite(candidate.updated_ts)
        ? candidate.updated_ts
        : Date.now()
  };
}

function isBdIdentity(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "agent_bd" || normalized === "bd" || normalized.endsWith("_bd");
}

function parseBdChatMessage(envelope: Envelope): BdChatMessage | null {
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const threadId = payload.thread_id;
  const from = payload.from;
  const to = payload.to;
  const text = payload.text;
  if (
    typeof threadId !== "string" ||
    typeof from !== "string" ||
    typeof to !== "string" ||
    typeof text !== "string"
  ) {
    return null;
  }
  if (threadId.trim() !== "bd_main" || text.trim().length === 0) {
    return null;
  }
  if (!isBdIdentity(from) && !isBdIdentity(to)) {
    return null;
  }

  const suggestedActionsRaw = Array.isArray(payload.suggested_actions) ? payload.suggested_actions : [];
  const suggestedActions = suggestedActionsRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.action !== "string" || typeof candidate.label !== "string") {
        return null;
      }
      const action = candidate.action.trim();
      const label = candidate.label.trim();
      if (!action || !label) {
        return null;
      }
      return { action, label };
    })
    .filter((entry): entry is { action: string; label: string } => Boolean(entry));

  return {
    messageId:
      envelope.id ??
      `chat_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    threadId: threadId.trim(),
    from: from.trim(),
    to: to.trim(),
    text: text.trim(),
    suggestedActions,
    ts: typeof envelope.ts === "number" ? envelope.ts : Date.now()
  };
}

export function useWorldSocket(sceneId = "cozy_office_v0") {
  const clientRef = useRef<WorldSocketClient | null>(null);

  useEffect(() => {
    const offlineMode = isOfflineMockWorldEnabled();
    const autoConnect = shouldAutoConnectWorldSocket();
    const wsUrl = worldSocketUrl();

    const world = useWorldStore.getState();
    world.setScene(sceneId);

    if (offlineMode) {
      const runtime = createOfflineMockWorldRuntime({ sceneId });
      runtime.start();
      return () => {
        runtime.stop();
      };
    }

    if (!autoConnect) {
      world.setConnectionState("disconnected", {
        reconnectAttempt: 0,
        error: "WebSocket auto-connect disabled (VITE_WORLD_WS_AUTO_CONNECT=0)."
      });
      return;
    }

    const client = new WorldSocketClient({
      url: wsUrl,
      sceneId,
      onConnectionState: ({ status, reconnectAttempt, error }) => {
        useWorldStore.getState().setConnectionState(status, {
          reconnectAttempt,
          error
        });
      },
      onEnvelope: (envelope) => {
        const parsed = envelope as Envelope;
        const world = useWorldStore.getState();

        if (parsed.type === "snapshot") {
          const rawAgents = parsed.payload?.agents;
          const rawTasks = parsed.payload?.tasks;
          const rawArtifacts = parsed.payload?.artifacts;
          const rawDecisions = parsed.payload?.decisions;
          if (!Array.isArray(rawAgents) || !Array.isArray(rawTasks)) {
            return;
          }

          for (const rawAgent of rawAgents) {
            const snapshot = parseAgentSnapshot(rawAgent);
            if (!snapshot) {
              continue;
            }
            world.upsertAgent(snapshot);
          }

          const parsedTasks = rawTasks
            .map((task) => parseTaskSnapshot(task))
            .filter((task): task is TaskSnapshot => Boolean(task));
          world.replaceTasks(parsedTasks);

          const parsedArtifacts = (Array.isArray(rawArtifacts) ? rawArtifacts : [])
            .map((artifact) => parseArtifactSnapshot(artifact))
            .filter((artifact): artifact is ArtifactSnapshot => Boolean(artifact));
          useUiStore.getState().setArtifacts(parsedArtifacts);

          const parsedDecisions = (Array.isArray(rawDecisions) ? rawDecisions : [])
            .map((decision) => parseDecisionSnapshot(decision))
            .filter((decision): decision is DecisionSnapshot => Boolean(decision));
          useUiStore.getState().setDecisions(parsedDecisions);
          return;
        }

        if (parsed.type === "agent_goal") {
          const parsedGoal = parseAgentGoal(parsed);
          if (parsedGoal) {
            world.upsertAgentGoal(parsedGoal.agentId, parsedGoal.goal);
          }
          return;
        }

        if (parsed.type === "event") {
          const parsedEvent = parseWorldEvent(parsed);
          if (parsedEvent) {
            world.appendEvent(parsedEvent);
            if (parsedEvent.name === "task_assigned" && parsedEvent.taskId) {
              useUiStore.getState().setTaskBoardNotice({
                level: "success",
                message: parsedEvent.agentId
                  ? `${parsedEvent.taskId} assigned to ${parsedEvent.agentId}.`
                  : `${parsedEvent.taskId} assignment updated.`
              });
            }
            if (
              (parsedEvent.name === "decision_requested" || parsedEvent.name === "task_blocked") &&
              parsedEvent.taskId
            ) {
              useUiStore.getState().setTaskBoardNotice({
                level: "error",
                message: parsedEvent.decisionId
                  ? `${parsedEvent.taskId} blocked by ${parsedEvent.decisionId}.`
                  : `${parsedEvent.taskId} is blocked pending user decision.`
              });
            }
            if (parsedEvent.decisionId && parsedEvent.name === "decision_requested") {
              useUiStore.getState().upsertDecision({
                decisionId: parsedEvent.decisionId,
                projectId: parsedEvent.projectId,
                taskId: parsedEvent.taskId,
                prompt:
                  typeof parsedEvent.meta?.prompt === "string"
                    ? parsedEvent.meta.prompt
                    : "Decision pending",
                status: "open",
                updatedTs: parsedEvent.ts
              });
            }
            if (parsedEvent.decisionId && parsedEvent.name === "decision_resolved") {
              useUiStore.getState().markDecisionResolved(
                parsedEvent.decisionId,
                typeof parsedEvent.meta?.choice === "string" ? parsedEvent.meta.choice : undefined
              );
            }
            if (parsedEvent.artifactId) {
              const nextStatus = artifactStatusFromEvent(parsedEvent);
              if (nextStatus) {
                useUiStore
                  .getState()
                  .markArtifactStatus(parsedEvent.artifactId, nextStatus, parsedEvent.ts);
              }
            }
            if (parsedEvent.name === "task_reassigned" && parsedEvent.taskId) {
              useUiStore.getState().setTaskBoardNotice({
                level: "success",
                message: parsedEvent.agentId
                  ? `${parsedEvent.taskId} reassigned to ${parsedEvent.agentId}.`
                  : `${parsedEvent.taskId} reassigned.`
              });
            }
            if (parsedEvent.name === "task_cancelled" && parsedEvent.taskId) {
              useUiStore.getState().setTaskBoardNotice({
                level: "success",
                message: `${parsedEvent.taskId} cancelled by override.`
              });
            }
            if (parsedEvent.name === "project_paused") {
              useUiStore.getState().setTaskBoardNotice({
                level: "success",
                message: `${parsedEvent.projectId} dispatch paused.`
              });
            }
            if (parsedEvent.name === "project_resumed") {
              useUiStore.getState().setTaskBoardNotice({
                level: "success",
                message: `${parsedEvent.projectId} dispatch resumed.`
              });
            }
          }
        }

        if (parsed.type === "chat") {
          const chatMessage = parseBdChatMessage(parsed);
          if (chatMessage) {
            useUiStore.getState().appendBdChatMessage(chatMessage);
          }
        }
      },
      onResumeCursor: (cursor) => {
        useWorldStore.getState().setResumeCursor({
          lastSeq: cursor.lastSeq,
          lastSnapshotId: cursor.lastSnapshotId
        });
      },
      onCommandResult: ({ kind, commandId, commandName, code, message }) => {
        if (commandName === "submit_request") {
          if (kind === "ack") {
            const ui = useUiStore.getState();
            ui.setInboxNotice({
              level: "success",
              message: "Request accepted. Kickoff is starting."
            });
            ui.setFocusedPoi("poi_task_board");
            ui.openPanel("task-board");
            return;
          }

          useUiStore.getState().setInboxNotice({
            level: "error",
            message: inboxErrorMicrocopy(code, message)
          });
          return;
        }

        if (commandName === "resolve_decision") {
          if (kind === "ack") {
            const ui = useUiStore.getState();
            ui.setDecisionNotice({
              level: "success",
              message: "Decision resolved. Blocked work can now resume."
            });
            ui.openPanel("task-board");
            return;
          }
          useUiStore.getState().setDecisionNotice({
            level: "error",
            message: decisionErrorMicrocopy(code, message)
          });
          return;
        }

        if (
          commandName === "approve_artifact" ||
          commandName === "request_changes" ||
          commandName === "split_into_tasks"
        ) {
          const ui = useUiStore.getState();
          if (kind === "ack") {
            if (ui.focusedArtifactId && commandName === "approve_artifact") {
              ui.markArtifactStatus(ui.focusedArtifactId, "approved");
            }
            if (ui.focusedArtifactId && commandName === "request_changes") {
              ui.markArtifactStatus(ui.focusedArtifactId, "changes_requested");
            }
            if (ui.focusedArtifactId && commandName === "split_into_tasks") {
              const focusedArtifact = ui.artifacts[ui.focusedArtifactId];
              if (focusedArtifact?.status === "delivered") {
                ui.markArtifactStatus(ui.focusedArtifactId, "in_review");
              }
            }

            ui.setArtifactNotice({
              level: "success",
              message:
                commandName === "approve_artifact"
                  ? "Artifact approved. Linked task completion will appear in world updates."
                  : commandName === "request_changes"
                    ? "Change request accepted. Waiting for revised artifact delivery."
                    : "Split accepted. Follow-up tasks are being created."
            });
            if (commandName === "split_into_tasks" || commandName === "approve_artifact") {
              ui.openPanel("task-board");
            }
            return;
          }

          ui.setArtifactNotice({
            level: "error",
            message: artifactErrorMicrocopy(code, message)
          });
          return;
        }

        if (
          commandName === "reassign_task" ||
          commandName === "cancel_task" ||
          commandName === "pause_project" ||
          commandName === "resume_project" ||
          commandName === "rerun_task"
        ) {
          const ui = useUiStore.getState();
          if (kind === "ack") {
            ui.setTaskBoardNotice({
              level: "success",
              message:
                commandName === "reassign_task"
                  ? "Reassign override accepted. Waiting for reflected state updates."
                  : commandName === "cancel_task"
                    ? "Cancel override accepted. Waiting for reflected state updates."
                    : commandName === "pause_project"
                      ? "Project pause accepted. New dispatch is now blocked."
                      : commandName === "resume_project"
                        ? "Project resume accepted. Dispatch can continue."
                        : "Rerun override accepted. Follow-up task creation is pending."
            });
            ui.openPanel("task-board");
            return;
          }

          ui.setTaskBoardNotice({
            level: "error",
            message: overrideErrorMicrocopy(commandName, code, message)
          });
          return;
        }

        if (commandName !== "assign_task" && commandName !== "auto_assign") {
          return;
        }

        if (kind === "ack") {
          if (commandName === "assign_task") {
            useWorldStore.getState().resolveOptimisticTaskAssignment(commandId, true);
          }
          const noticeMessage =
            commandName === "assign_task"
              ? "Task assignment accepted."
              : "Auto-assign accepted.";
          useUiStore.getState().setTaskBoardNotice({
            level: "success",
            message: noticeMessage
          });
          return;
        }

        if (commandName === "assign_task") {
          useWorldStore.getState().resolveOptimisticTaskAssignment(commandId, false);
        }
        useUiStore.getState().setTaskBoardNotice({
          level: "error",
          message: taskBoardErrorMicrocopy(code, message)
        });
      },
      getResumeCursor: () => {
        const state = useWorldStore.getState();
        return {
          lastSeq: state.lastSeq,
          lastSnapshotId: state.lastSnapshotId
        };
      }
    });

    clientRef.current = client;
    setWorldSocketClient(client);
    client.start();

    return () => {
      client.stop();
      clientRef.current = null;
      setWorldSocketClient(null);
    };
  }, [sceneId]);
}
