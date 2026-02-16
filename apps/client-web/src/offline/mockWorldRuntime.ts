import {
  useWorldStore,
  type AgentGoal,
  type AgentSnapshot,
  type TaskSnapshot,
  type WorldEvent
} from "../state/worldStore";
import type {
  CommandDataMap,
  CommandGateway,
  CommandName,
  CommandResultEvent,
  CommandSubmission
} from "../network/commandGateway";
import { useUiStore, type ArtifactSnapshot } from "../state/uiStore";

const TICK_INTERVAL_MS = 1200;
const OFFLINE_PROJECT_ID = "proj_offline_001";
const OFFLINE_ARTIFACT_ID = "artifact_offline_wireframe_v1";
const OFFLINE_BD_AGENT_ID = "agent_bd";
const OFFLINE_INBOX_POI_ID = "poi_reception_inbox";
const OFFLINE_TASK_BOARD_POI_ID = "poi_task_board";
const OFFLINE_DELIVERY_POI_ID = "poi_delivery_shelf";
const OFFLINE_DESK_POI_ID = "poi_dev_desk_1";
const OFFLINE_BD_DESK_ROUTE: [number, number, number][] = [
  [0.95, 0, -1.05],
  [0.62, 0, -0.82],
  [0.34, 0, -0.58],
  [0.125, 0, -0.375]
];

const BASE_TASKS: TaskSnapshot[] = [
  {
    id: "task_offline_research",
    projectId: OFFLINE_PROJECT_ID,
    title: "Research launch constraints",
    status: "in_progress",
    assignee: "agent_research_1"
  },
  {
    id: "task_offline_wireframe",
    projectId: OFFLINE_PROJECT_ID,
    title: "Draft workspace wireframes",
    status: "planned",
    assignee: "agent_design_1"
  },
  {
    id: "task_offline_copy",
    projectId: OFFLINE_PROJECT_ID,
    title: "Prepare onboarding copy",
    status: "blocked"
  }
];

const BASE_AGENTS: AgentSnapshot[] = [
  { id: "agent_bd", pos: [0.95, 0, -1.05], state: "walking" },
  {
    id: "agent_research_1",
    pos: [1.1, 0, -0.65],
    state: "working",
    taskId: "task_offline_research"
  },
  {
    id: "agent_design_1",
    pos: [-1.3, 0, 0.6],
    state: "walking",
    taskId: "task_offline_wireframe"
  }
];

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

function buildBdAgentFrame(tick: number): AgentSnapshot {
  const routeIndex = Math.min(tick, OFFLINE_BD_DESK_ROUTE.length - 1);
  const routePos = OFFLINE_BD_DESK_ROUTE[routeIndex] ?? OFFLINE_BD_DESK_ROUTE[OFFLINE_BD_DESK_ROUTE.length - 1];
  const atDesk = routeIndex >= OFFLINE_BD_DESK_ROUTE.length - 1;
  return {
    ...BASE_AGENTS[0],
    pos: routePos,
    state: atDesk ? "working" : "walking"
  };
}

function buildAgentFrame(tick: number): AgentSnapshot[] {
  return [
    buildBdAgentFrame(tick),
    {
      ...BASE_AGENTS[1],
      pos: [rounded(1.1 + Math.sin(tick / 2.5) * 0.16), 0, rounded(-0.65 + Math.cos(tick / 3) * 0.1)],
      state: tick % 4 === 0 ? "walking" : "working"
    },
    {
      ...BASE_AGENTS[2],
      pos: [rounded(-1.3 + Math.cos(tick / 2) * 0.22), 0, rounded(0.6 + Math.sin(tick / 2) * 0.14)],
      state: tick % 3 === 0 ? "working" : "walking"
    }
  ];
}

function buildTaskFrame(tick: number): TaskSnapshot[] {
  return [
    BASE_TASKS[0],
    {
      ...BASE_TASKS[1],
      status: tick >= 3 ? "in_progress" : "planned"
    },
    {
      ...BASE_TASKS[2],
      status: tick >= 6 ? "planned" : "blocked",
      assignee: tick >= 7 ? "agent_bd" : undefined
    }
  ];
}

function buildGoal(agentId: string, tick: number): AgentGoal {
  const base = agentId === "agent_research_1" ? 0.85 : -1.35;
  const delta = agentId === "agent_research_1" ? 0.35 : 0.42;
  return {
    goalId: `offline_goal_${agentId}_${tick}`,
    kind: "go_to_poi",
    path: [
      [rounded(base), 0, rounded(-0.55 + Math.sin(tick / 4) * 0.08)],
      [rounded(base + delta), 0, rounded(-0.35 + Math.cos(tick / 4) * 0.08)]
    ],
    speedMps: 0.85,
    arrivalRadius: 0.2
  };
}

function buildBdDeskGoal(tick: number): AgentGoal | null {
  const routeIndex = Math.min(tick, OFFLINE_BD_DESK_ROUTE.length - 1);
  if (routeIndex >= OFFLINE_BD_DESK_ROUTE.length - 1) {
    return null;
  }
  const remainingPath = OFFLINE_BD_DESK_ROUTE.slice(routeIndex + 1);
  return {
    goalId: `offline_goal_${OFFLINE_BD_AGENT_ID}_desk_${tick}`,
    kind: "go_to_poi",
    path: remainingPath,
    speedMps: 0.95,
    arrivalRadius: 0.15
  };
}

function seededEvents(): WorldEvent[] {
  return [
    {
      id: "offline_event_0001",
      ts: Date.now(),
      seq: 1,
      name: "kickoff_started",
      projectId: OFFLINE_PROJECT_ID,
      taskId: "task_offline_research",
      poiId: OFFLINE_INBOX_POI_ID,
      agentId: OFFLINE_BD_AGENT_ID,
      participants: [OFFLINE_BD_AGENT_ID, "agent_research_1", "agent_design_1"]
    },
    {
      id: "offline_event_0002",
      ts: Date.now(),
      seq: 2,
      name: "tasks_created",
      projectId: OFFLINE_PROJECT_ID,
      taskId: "task_offline_wireframe",
      poiId: OFFLINE_TASK_BOARD_POI_ID,
      agentId: "agent_design_1",
      participants: [OFFLINE_BD_AGENT_ID, "agent_design_1"]
    }
  ];
}

interface OfflineMockWorldRuntimeOptions {
  sceneId: string;
  onCommandResult?: (result: CommandResultEvent) => void;
}

interface OfflineMockWorldRuntime {
  commandGateway: CommandGateway;
  start: () => void;
  stop: () => void;
}

function compactRequestTitle(requestText: string): string {
  const normalized = requestText.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Offline request";
  }
  return normalized.length <= 52 ? normalized : `${normalized.slice(0, 49)}...`;
}

function firstNonBdParticipant(participants: string[]): string | undefined {
  return participants.find((participantId) => participantId !== OFFLINE_BD_AGENT_ID);
}

function inferOfflinePoiForEvent(event: Omit<WorldEvent, "id" | "ts" | "seq">): string | undefined {
  if (event.poiId) {
    return event.poiId;
  }
  const taskToken = typeof event.taskId === "string" ? event.taskId.toLowerCase() : "";
  if (event.artifactId) {
    return OFFLINE_DELIVERY_POI_ID;
  }
  if (event.name === "kickoff_started") {
    return OFFLINE_INBOX_POI_ID;
  }
  if (
    event.name === "task_done" &&
    (taskToken.includes("wireframe") || taskToken.includes("artifact") || taskToken.includes("delivery"))
  ) {
    return OFFLINE_DELIVERY_POI_ID;
  }
  if (
    event.name === "tasks_created" ||
    event.name === "task_assigned" ||
    event.name === "task_done" ||
    event.name === "task_blocked" ||
    event.name === "decision_requested" ||
    event.name === "decision_resolved"
  ) {
    return OFFLINE_TASK_BOARD_POI_ID;
  }
  return undefined;
}

function offlineArtifactSeeds(timestamp: number): ArtifactSnapshot[] {
  return [
    {
      artifactId: OFFLINE_ARTIFACT_ID,
      projectId: OFFLINE_PROJECT_ID,
      type: "wireframe",
      status: "delivered",
      version: 1,
      taskId: "task_offline_wireframe",
      poiId: "poi_delivery_shelf",
      updatedTs: timestamp
    }
  ];
}

export function createOfflineMockWorldRuntime({
  sceneId,
  onCommandResult
}: OfflineMockWorldRuntimeOptions): OfflineMockWorldRuntime {
  let timer: ReturnType<typeof setInterval> | null = null;
  let tick = 0;
  let seq = 2;
  let commandCount = 0;

  function appendOfflineEvent(event: Omit<WorldEvent, "id" | "ts" | "seq">): void {
    seq += 1;
    const ts = Date.now();
    const participants = Array.isArray(event.participants) ? event.participants : [];
    const fallbackAgentId = firstNonBdParticipant(participants) ?? participants[0];
    const resolvedAgentId = event.agentId ?? fallbackAgentId;
    const resolvedPoiId = inferOfflinePoiForEvent(event);

    useWorldStore.getState().appendEvent({
      ...event,
      participants,
      agentId: resolvedAgentId,
      poiId: resolvedPoiId,
      id: `offline_event_${String(seq).padStart(4, "0")}`,
      ts,
      seq
    });
    useWorldStore.getState().setResumeCursor({
      lastSeq: seq,
      lastSnapshotId: "offline_snapshot_001"
    });

    const ui = useUiStore.getState();
    const commandName = typeof event.meta?.command_name === "string" ? event.meta.command_name : undefined;

    if (event.name === "kickoff_started" && commandName === "submit_request") {
      ui.setInboxNotice({
        level: "success",
        message: "Kickoff started. Task Board will update with initial work."
      });
      return;
    }

    if (event.name === "tasks_created" && commandName === "submit_request") {
      ui.setInboxNotice({
        level: "success",
        message: "Initial tasks created. Review assignments in Task Board."
      });
      ui.openPanel("task-board");
      return;
    }

    if ((event.name === "decision_requested" || event.name === "task_blocked") && event.taskId) {
      ui.setTaskBoardNotice({
        level: "error",
        message: event.decisionId
          ? `${event.taskId} blocked by ${event.decisionId}.`
          : `${event.taskId} is blocked pending user decision.`
      });
      ui.setDecisionNotice({
        level: "error",
        message: event.decisionId
          ? `${event.taskId} needs ${event.decisionId}. Open Decisions to unblock progress.`
          : `${event.taskId} is blocked. A decision prompt will appear when available.`
      });
      ui.openPanel("decision-panel");
    }

    if (event.decisionId && event.name === "decision_requested") {
      ui.upsertDecision({
        decisionId: event.decisionId,
        projectId: event.projectId,
        taskId: event.taskId,
        prompt:
          typeof event.meta?.prompt === "string"
            ? event.meta.prompt
            : "Decision pending",
        status: "open",
        updatedTs: ts
      });
      return;
    }

    if (event.decisionId && event.name === "decision_resolved") {
      ui.markDecisionResolved(
        event.decisionId,
        typeof event.meta?.choice === "string" ? event.meta.choice : undefined
      );
      ui.setDecisionNotice({
        level: "success",
        message: "Decision resolved. Previously blocked tasks can continue."
      });
    }
  }

  function nextCommandSubmission<K extends CommandName>(name: K): CommandSubmission<K> {
    commandCount += 1;
    return {
      commandId: `offline_cmd_${name}_${String(commandCount).padStart(4, "0")}`,
      commandName: name,
      sentAt: Date.now()
    };
  }

  function emitCommandResult(result: CommandResultEvent): void {
    onCommandResult?.(result);
  }

  function emitCommandError<K extends CommandName>(
    submission: CommandSubmission<K>,
    code: "VALIDATION_FAILED" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "NOT_ALLOWED" | "INTERNAL",
    message: string
  ): void {
    emitCommandResult({
      kind: "error",
      commandId: submission.commandId,
      commandName: submission.commandName,
      code,
      message,
      receivedAt: Date.now()
    });
  }

  function emitCommandAck<K extends CommandName>(submission: CommandSubmission<K>): void {
    emitCommandResult({
      kind: "ack",
      commandId: submission.commandId,
      commandName: submission.commandName,
      receivedAt: Date.now()
    });
  }

  function simulateSubmitRequest(
    submission: CommandSubmission<"submit_request">,
    data: CommandDataMap["submit_request"]
  ): void {
    const requestText = data.text.trim();
    if (!requestText) {
      emitCommandError(submission, "VALIDATION_FAILED", "Request text is required.");
      return;
    }

    const world = useWorldStore.getState();
    const taskId = `task_offline_request_${String(commandCount).padStart(4, "0")}`;
    const generatedTask: TaskSnapshot = {
      id: taskId,
      projectId: OFFLINE_PROJECT_ID,
      title: `Kickoff: ${compactRequestTitle(requestText)}`,
      status: "planned",
      assignee: "agent_bd"
    };
    world.replaceTasks([...Object.values(world.tasks), generatedTask]);

    appendOfflineEvent({
      name: "kickoff_started",
      projectId: OFFLINE_PROJECT_ID,
      taskId,
      participants: ["agent_bd", "agent_research_1", "agent_design_1"],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "submit_request"
      }
    });
    appendOfflineEvent({
      name: "tasks_created",
      projectId: OFFLINE_PROJECT_ID,
      taskId,
      participants: ["agent_bd"],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "submit_request",
        request_text: requestText
      }
    });

    emitCommandAck(submission);
  }

  function simulateAssignTask(
    submission: CommandSubmission<"assign_task">,
    data: CommandDataMap["assign_task"]
  ): void {
    const taskId = data.task_id.trim();
    const agentId = data.agent_id.trim();
    if (!taskId || !agentId) {
      emitCommandError(
        submission,
        "VALIDATION_FAILED",
        "task_id and agent_id are required for assignment."
      );
      return;
    }

    const world = useWorldStore.getState();
    const task = world.tasks[taskId];
    if (!task) {
      emitCommandError(submission, "NOT_FOUND", `Task ${taskId} was not found.`);
      return;
    }
    if (!world.agents[agentId]) {
      emitCommandError(submission, "NOT_FOUND", `Agent ${agentId} was not found.`);
      return;
    }

    world.replaceTasks(
      Object.values(world.tasks).map((candidate) =>
        candidate.id === taskId ? { ...candidate, assignee: agentId } : candidate
      )
    );

    appendOfflineEvent({
      name: "task_assigned",
      projectId: task.projectId,
      taskId,
      agentId,
      participants: ["agent_bd", agentId],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "assign_task",
        assignment_mode: "manual",
        from_agent_id: task.assignee ?? null
      }
    });

    emitCommandAck(submission);
  }

  function simulateAutoAssign(
    submission: CommandSubmission<"auto_assign">,
    data: CommandDataMap["auto_assign"]
  ): void {
    const projectId = data.project_id.trim();
    if (!projectId) {
      emitCommandError(submission, "VALIDATION_FAILED", "project_id is required for auto-assign.");
      return;
    }

    const world = useWorldStore.getState();
    const projectTasks = Object.values(world.tasks).filter((task) => task.projectId === projectId);
    if (projectTasks.length === 0) {
      emitCommandError(submission, "NOT_FOUND", `Project ${projectId} has no tasks to assign.`);
      return;
    }

    const specialists = Object.values(world.agents)
      .map((agent) => agent.id)
      .filter((agentId) => agentId !== "agent_bd")
      .sort((left, right) => left.localeCompare(right));
    if (specialists.length === 0) {
      emitCommandError(submission, "NOT_ALLOWED", "No specialist agents are available for auto-assign.");
      return;
    }

    const assignableTasks = projectTasks
      .filter((task) => !task.assignee && task.status !== "done" && task.status !== "cancelled")
      .sort((left, right) => left.id.localeCompare(right.id));
    if (assignableTasks.length === 0) {
      emitCommandError(submission, "CONFLICT", "No unassigned active tasks are available for auto-assign.");
      return;
    }

    const assignments = new Map<string, string>();
    assignableTasks.forEach((task, index) => {
      assignments.set(task.id, specialists[index % specialists.length]);
    });

    world.replaceTasks(
      Object.values(world.tasks).map((task) => {
        const assignee = assignments.get(task.id);
        return assignee ? { ...task, assignee } : task;
      })
    );

    assignableTasks.forEach((task) => {
      const assignee = assignments.get(task.id);
      if (!assignee) {
        return;
      }
      appendOfflineEvent({
        name: "task_assigned",
        projectId: task.projectId,
        taskId: task.id,
        agentId: assignee,
        participants: ["agent_bd", assignee],
        meta: {
          source: "offline_gateway",
          command_id: submission.commandId,
          command_name: "auto_assign",
          assignment_mode: "auto"
        }
      });
    });

    emitCommandAck(submission);
  }

  function simulateResolveDecision(
    submission: CommandSubmission<"resolve_decision">,
    data: CommandDataMap["resolve_decision"]
  ): void {
    const decisionId = data.decision_id.trim();
    const choice = data.choice.trim();
    const note = data.note?.trim();
    if (!decisionId || !choice) {
      emitCommandError(
        submission,
        "VALIDATION_FAILED",
        "decision_id and choice are required for resolve_decision."
      );
      return;
    }

    const ui = useUiStore.getState();
    const world = useWorldStore.getState();
    let decision = ui.decisions[decisionId];

    if (!decision) {
      const relatedEvent = [...world.events]
        .reverse()
        .find((event) => event.decisionId === decisionId && event.name === "decision_requested");
      if (!relatedEvent) {
        emitCommandError(submission, "NOT_FOUND", `Decision ${decisionId} was not found.`);
        return;
      }

      decision = {
        decisionId,
        projectId: relatedEvent.projectId,
        taskId: relatedEvent.taskId,
        prompt:
          typeof relatedEvent.meta?.prompt === "string"
            ? relatedEvent.meta.prompt
            : "Decision pending",
        status: "open",
        updatedTs: relatedEvent.ts
      };
      ui.upsertDecision(decision);
    }

    if (decision.status === "resolved") {
      emitCommandError(submission, "CONFLICT", `Decision ${decisionId} is already resolved.`);
      return;
    }

    ui.markDecisionResolved(decisionId, choice);

    if (decision.taskId) {
      const task = world.tasks[decision.taskId];
      if (task && task.status === "blocked") {
        world.replaceTasks(
          Object.values(world.tasks).map((candidate) =>
            candidate.id === decision.taskId ? { ...candidate, status: "planned" } : candidate
          )
        );
      }
    }

    appendOfflineEvent({
      name: "decision_resolved",
      projectId: decision.projectId,
      taskId: decision.taskId,
      decisionId,
      participants: ["agent_bd"],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "resolve_decision",
        choice,
        note: note || undefined
      }
    });

    emitCommandAck(submission);
  }

  function simulateApproveArtifact(
    submission: CommandSubmission<"approve_artifact">,
    data: CommandDataMap["approve_artifact"]
  ): void {
    const artifactId = data.artifact_id.trim();
    if (!artifactId) {
      emitCommandError(submission, "VALIDATION_FAILED", "artifact_id is required for approve_artifact.");
      return;
    }

    const ui = useUiStore.getState();
    const artifact = ui.artifacts[artifactId];
    if (!artifact) {
      emitCommandError(submission, "NOT_FOUND", `Artifact ${artifactId} was not found.`);
      return;
    }
    if (artifact.status === "approved") {
      emitCommandError(submission, "CONFLICT", `Artifact ${artifactId} is already approved.`);
      return;
    }

    ui.markArtifactStatus(artifactId, "approved");

    const world = useWorldStore.getState();
    if (artifact.taskId) {
      const task = world.tasks[artifact.taskId];
      if (task && task.status !== "done") {
        world.replaceTasks(
          Object.values(world.tasks).map((candidate) =>
            candidate.id === artifact.taskId ? { ...candidate, status: "done" } : candidate
          )
        );
      }
    }

    appendOfflineEvent({
      name: "review_approved",
      projectId: artifact.projectId,
      taskId: artifact.taskId,
      artifactId,
      participants: ["agent_bd"],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "approve_artifact"
      }
    });

    emitCommandAck(submission);
  }

  function simulateRequestChanges(
    submission: CommandSubmission<"request_changes">,
    data: CommandDataMap["request_changes"]
  ): void {
    const artifactId = data.artifact_id.trim();
    const instructions = data.instructions.trim();
    if (!artifactId || !instructions) {
      emitCommandError(
        submission,
        "VALIDATION_FAILED",
        "artifact_id and instructions are required for request_changes."
      );
      return;
    }

    const ui = useUiStore.getState();
    const artifact = ui.artifacts[artifactId];
    if (!artifact) {
      emitCommandError(submission, "NOT_FOUND", `Artifact ${artifactId} was not found.`);
      return;
    }

    ui.markArtifactStatus(artifactId, "changes_requested");

    const world = useWorldStore.getState();
    if (artifact.taskId) {
      const task = world.tasks[artifact.taskId];
      if (task && task.status === "done") {
        world.replaceTasks(
          Object.values(world.tasks).map((candidate) =>
            candidate.id === artifact.taskId ? { ...candidate, status: "in_progress" } : candidate
          )
        );
      }
    }

    appendOfflineEvent({
      name: "review_changes_requested",
      projectId: artifact.projectId,
      taskId: artifact.taskId,
      artifactId,
      participants: ["agent_bd"],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "request_changes",
        instructions
      }
    });

    emitCommandAck(submission);
  }

  function simulateSplitIntoTasks(
    submission: CommandSubmission<"split_into_tasks">,
    data: CommandDataMap["split_into_tasks"]
  ): void {
    const artifactId = data.artifact_id.trim();
    const taskTitles = data.task_titles
      .map((title) => title.trim())
      .filter((title) => title.length > 0);
    if (!artifactId || taskTitles.length === 0) {
      emitCommandError(
        submission,
        "VALIDATION_FAILED",
        "artifact_id and at least one task title are required for split_into_tasks."
      );
      return;
    }

    const ui = useUiStore.getState();
    const artifact = ui.artifacts[artifactId];
    if (!artifact) {
      emitCommandError(submission, "NOT_FOUND", `Artifact ${artifactId} was not found.`);
      return;
    }

    const world = useWorldStore.getState();
    const followUpTasks: TaskSnapshot[] = taskTitles.map((title, index) => ({
      id: `task_offline_split_${String(commandCount).padStart(4, "0")}_${String(index + 1).padStart(2, "0")}`,
      projectId: artifact.projectId,
      title,
      status: "planned"
    }));
    world.replaceTasks([...Object.values(world.tasks), ...followUpTasks]);
    ui.markArtifactStatus(artifactId, "in_review");

    appendOfflineEvent({
      name: "tasks_created",
      projectId: artifact.projectId,
      taskId: followUpTasks[0]?.id,
      artifactId,
      participants: ["agent_bd"],
      meta: {
        source: "offline_gateway",
        command_id: submission.commandId,
        command_name: "split_into_tasks",
        generated_task_ids: followUpTasks.map((task) => task.id)
      }
    });

    emitCommandAck(submission);
  }

  const commandGateway: CommandGateway = {
    sendCommand<K extends CommandName>(name: K, data: CommandDataMap[K]): CommandSubmission<K> | null {
      const submission = nextCommandSubmission(name);
      switch (name) {
        case "submit_request":
          simulateSubmitRequest(
            submission as CommandSubmission<"submit_request">,
            data as CommandDataMap["submit_request"]
          );
          return submission;
        case "assign_task":
          simulateAssignTask(
            submission as CommandSubmission<"assign_task">,
            data as CommandDataMap["assign_task"]
          );
          return submission;
        case "auto_assign":
          simulateAutoAssign(
            submission as CommandSubmission<"auto_assign">,
            data as CommandDataMap["auto_assign"]
          );
          return submission;
        case "resolve_decision":
          simulateResolveDecision(
            submission as CommandSubmission<"resolve_decision">,
            data as CommandDataMap["resolve_decision"]
          );
          return submission;
        case "approve_artifact":
          simulateApproveArtifact(
            submission as CommandSubmission<"approve_artifact">,
            data as CommandDataMap["approve_artifact"]
          );
          return submission;
        case "request_changes":
          simulateRequestChanges(
            submission as CommandSubmission<"request_changes">,
            data as CommandDataMap["request_changes"]
          );
          return submission;
        case "split_into_tasks":
          simulateSplitIntoTasks(
            submission as CommandSubmission<"split_into_tasks">,
            data as CommandDataMap["split_into_tasks"]
          );
          return submission;
        default:
          return null;
      }
    }
  };

  function appendSyntheticEvent(): void {
    const eventName = tick % 6 === 0 ? "decision_requested" : tick % 4 === 0 ? "task_assigned" : "task_done";
    appendOfflineEvent({
      name: eventName,
      projectId: OFFLINE_PROJECT_ID,
      taskId:
        eventName === "task_assigned" || eventName === "task_done"
          ? "task_offline_wireframe"
          : "task_offline_copy",
      decisionId: eventName === "decision_requested" ? "dec_offline_scope" : undefined,
      participants: ["agent_bd", "agent_research_1"]
    });
  }

  function pushFrame(): void {
    const world = useWorldStore.getState();
    const agents = buildAgentFrame(tick);
    const tasks = buildTaskFrame(tick);
    const bdDeskGoal = buildBdDeskGoal(tick);
    const goals: Array<{ agentId: string; goal: AgentGoal }> = [
      { agentId: "agent_research_1", goal: buildGoal("agent_research_1", tick) },
      { agentId: "agent_design_1", goal: buildGoal("agent_design_1", tick) }
    ];
    if (bdDeskGoal) {
      goals.push({ agentId: OFFLINE_BD_AGENT_ID, goal: bdDeskGoal });
    }

    world.bootstrapOfflineState({
      agents,
      goals,
      tasks,
      events: tick === 0 ? seededEvents() : world.events,
      lastSeq: seq,
      lastSnapshotId: "offline_snapshot_001"
    });

    if (tick === OFFLINE_BD_DESK_ROUTE.length - 1) {
      appendOfflineEvent({
        name: "task_assigned",
        projectId: OFFLINE_PROJECT_ID,
        taskId: "task_offline_copy",
        poiId: OFFLINE_DESK_POI_ID,
        agentId: OFFLINE_BD_AGENT_ID,
        participants: [OFFLINE_BD_AGENT_ID],
        meta: {
          source: "offline_behavior",
          behavior: "agent_bd_reached_desk_anchor"
        }
      });
    }

    // Keep timeline stable during the initial QA interaction window so event-feed
    // click targets remain deterministic across VQA-02/03/04.
    if (tick > 0 && tick % 10 === 0) {
      appendSyntheticEvent();
    }
  }

  return {
    commandGateway,
    start() {
      const world = useWorldStore.getState();
      world.setScene(sceneId);
      world.setConnectionState("connected", {
        reconnectAttempt: 0,
        error: null
      });
      const ui = useUiStore.getState();
      if (Object.keys(ui.artifacts).length === 0) {
        ui.setArtifacts(offlineArtifactSeeds(Date.now()));
      }

      tick = 0;
      seq = 2;
      commandCount = 0;
      pushFrame();

      timer = setInterval(() => {
        tick += 1;
        pushFrame();
      }, TICK_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      useWorldStore.getState().setConnectionState("disconnected", {
        reconnectAttempt: 0,
        error: "Offline mock mode stopped."
      });
    }
  };
}
