import {
  useWorldStore,
  type AgentGoal,
  type AgentSnapshot,
  type TaskSnapshot,
  type WorldEvent
} from "../state/worldStore";

const TICK_INTERVAL_MS = 1200;

const BASE_TASKS: TaskSnapshot[] = [
  {
    id: "task_offline_research",
    projectId: "proj_offline_001",
    title: "Research launch constraints",
    status: "in_progress",
    assignee: "agent_research_1"
  },
  {
    id: "task_offline_wireframe",
    projectId: "proj_offline_001",
    title: "Draft workspace wireframes",
    status: "planned",
    assignee: "agent_design_1"
  },
  {
    id: "task_offline_copy",
    projectId: "proj_offline_001",
    title: "Prepare onboarding copy",
    status: "blocked"
  }
];

const BASE_AGENTS: AgentSnapshot[] = [
  { id: "agent_bd", pos: [0.25, 0, 0.5], state: "idle" },
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

function buildAgentFrame(tick: number): AgentSnapshot[] {
  return [
    BASE_AGENTS[0],
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

function seededEvents(): WorldEvent[] {
  return [
    {
      id: "offline_event_0001",
      ts: Date.now(),
      seq: 1,
      name: "kickoff_started",
      projectId: "proj_offline_001",
      participants: ["agent_bd", "agent_research_1", "agent_design_1"]
    },
    {
      id: "offline_event_0002",
      ts: Date.now(),
      seq: 2,
      name: "tasks_created",
      projectId: "proj_offline_001",
      participants: ["agent_bd"]
    }
  ];
}

export function createOfflineMockWorldRuntime({ sceneId }: { sceneId: string }) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let tick = 0;
  let seq = 2;

  function appendSyntheticEvent(): void {
    seq += 1;
    const eventName = tick % 6 === 0 ? "decision_requested" : tick % 4 === 0 ? "task_assigned" : "task_done";
    useWorldStore.getState().appendEvent({
      id: `offline_event_${String(seq).padStart(4, "0")}`,
      ts: Date.now(),
      seq,
      name: eventName,
      projectId: "proj_offline_001",
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

    world.bootstrapOfflineState({
      agents,
      goals: [
        { agentId: "agent_research_1", goal: buildGoal("agent_research_1", tick) },
        { agentId: "agent_design_1", goal: buildGoal("agent_design_1", tick) }
      ],
      tasks,
      events: tick === 0 ? seededEvents() : world.events,
      lastSeq: seq,
      lastSnapshotId: "offline_snapshot_001"
    });

    if (tick > 0 && tick % 2 === 0) {
      appendSyntheticEvent();
      world.setResumeCursor({
        lastSeq: seq,
        lastSnapshotId: "offline_snapshot_001"
      });
    }
  }

  return {
    start() {
      const world = useWorldStore.getState();
      world.setScene(sceneId);
      world.setConnectionState("connected", {
        reconnectAttempt: 0,
        error: null
      });

      tick = 0;
      seq = 2;
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
