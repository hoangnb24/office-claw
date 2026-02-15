export type CommandErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_ALLOWED"
  | "INTERNAL";

export interface CommandResult {
  ok: boolean;
  code?: CommandErrorCode;
  message?: string;
}

interface Task {
  id: string;
  status: "planned" | "in_progress" | "blocked" | "done" | "cancelled";
}

interface Decision {
  id: string;
  status: "open" | "resolved" | "cancelled";
}

interface Artifact {
  id: string;
  status: "created" | "delivered" | "in_review" | "approved" | "changes_requested";
}

interface RouterState {
  projects: Set<string>;
  tasks: Map<string, Task>;
  decisions: Map<string, Decision>;
  artifacts: Map<string, Artifact>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateVec3(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

export class CommandRouter {
  private readonly state: RouterState;

  constructor() {
    this.state = {
      projects: new Set(["proj_boot", "proj_abc"]),
      tasks: new Map([
        ["task_copy", { id: "task_copy", status: "planned" }],
        ["task_research", { id: "task_research", status: "in_progress" }]
      ]),
      decisions: new Map([["dec_audience", { id: "dec_audience", status: "open" }]]),
      artifacts: new Map([
        ["art_research_report_v1", { id: "art_research_report_v1", status: "delivered" }]
      ])
    };
  }

  public handle(payload: unknown): CommandResult {
    if (!isObject(payload)) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "command payload must be an object"
      };
    }

    const name = payload.name;
    const data = payload.data;
    if (typeof name !== "string" || !isObject(data)) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "command payload requires {name,data}"
      };
    }

    switch (name) {
      case "submit_request":
        return this.handleSubmitRequest(data);
      case "assign_task":
        return this.handleAssignTask(data);
      case "auto_assign":
        return this.handleAutoAssign(data);
      case "resolve_decision":
        return this.handleResolveDecision(data);
      case "approve_artifact":
        return this.handleApproveArtifact(data);
      case "request_changes":
        return this.handleRequestChanges(data);
      case "split_into_tasks":
        return this.handleSplitIntoTasks(data);
      case "player_pos":
        return this.handlePlayerPos(data);
      case "move_player_to":
        return this.handleMovePlayerTo(data);
      case "start_kickoff":
        return this.handleStartKickoff(data);
      default:
        return {
          ok: false,
          code: "VALIDATION_FAILED",
          message: `unknown command: ${name}`
        };
    }
  }

  private handleSubmitRequest(data: Record<string, unknown>): CommandResult {
    if (typeof data.text !== "string" || data.text.trim().length === 0) {
      return { ok: false, code: "VALIDATION_FAILED", message: "text is required" };
    }
    return { ok: true };
  }

  private handleAssignTask(data: Record<string, unknown>): CommandResult {
    if (typeof data.task_id !== "string" || typeof data.agent_id !== "string") {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "task_id and agent_id are required"
      };
    }

    const task = this.state.tasks.get(data.task_id);
    if (!task) {
      return { ok: false, code: "NOT_FOUND", message: "task not found" };
    }
    if (task.status === "done" || task.status === "cancelled") {
      return {
        ok: false,
        code: "CONFLICT",
        message: "cannot assign a terminal task"
      };
    }

    return { ok: true };
  }

  private handleAutoAssign(data: Record<string, unknown>): CommandResult {
    if (typeof data.project_id !== "string") {
      return { ok: false, code: "VALIDATION_FAILED", message: "project_id is required" };
    }
    if (!this.state.projects.has(data.project_id)) {
      return { ok: false, code: "NOT_FOUND", message: "project not found" };
    }
    return { ok: true };
  }

  private handleResolveDecision(data: Record<string, unknown>): CommandResult {
    if (typeof data.decision_id !== "string" || typeof data.choice !== "string") {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "decision_id and choice are required"
      };
    }

    const decision = this.state.decisions.get(data.decision_id);
    if (!decision) {
      return { ok: false, code: "NOT_FOUND", message: "decision not found" };
    }
    if (decision.status !== "open") {
      return { ok: false, code: "CONFLICT", message: "decision is not open" };
    }

    decision.status = "resolved";
    return { ok: true };
  }

  private handleApproveArtifact(data: Record<string, unknown>): CommandResult {
    if (typeof data.artifact_id !== "string") {
      return { ok: false, code: "VALIDATION_FAILED", message: "artifact_id is required" };
    }

    const artifact = this.state.artifacts.get(data.artifact_id);
    if (!artifact) {
      return { ok: false, code: "NOT_FOUND", message: "artifact not found" };
    }
    if (!["delivered", "in_review", "changes_requested"].includes(artifact.status)) {
      return { ok: false, code: "CONFLICT", message: "artifact cannot be approved in current status" };
    }

    artifact.status = "approved";
    return { ok: true };
  }

  private handleRequestChanges(data: Record<string, unknown>): CommandResult {
    if (typeof data.artifact_id !== "string" || typeof data.instructions !== "string") {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "artifact_id and instructions are required"
      };
    }

    const artifact = this.state.artifacts.get(data.artifact_id);
    if (!artifact) {
      return { ok: false, code: "NOT_FOUND", message: "artifact not found" };
    }
    if (artifact.status === "approved") {
      return {
        ok: false,
        code: "CONFLICT",
        message: "cannot request changes after approval"
      };
    }

    artifact.status = "changes_requested";
    return { ok: true };
  }

  private handleSplitIntoTasks(data: Record<string, unknown>): CommandResult {
    if (typeof data.artifact_id !== "string" || !Array.isArray(data.task_titles)) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "artifact_id and task_titles are required"
      };
    }

    if (!this.state.artifacts.has(data.artifact_id)) {
      return { ok: false, code: "NOT_FOUND", message: "artifact not found" };
    }

    if (data.task_titles.length === 0 || !data.task_titles.every((item) => typeof item === "string" && item.trim().length > 0)) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "task_titles must contain at least one non-empty title"
      };
    }

    return { ok: true };
  }

  private handlePlayerPos(data: Record<string, unknown>): CommandResult {
    if (!validateVec3(data.pos)) {
      return { ok: false, code: "VALIDATION_FAILED", message: "pos must be [x,y,z]" };
    }
    if (data.facing !== undefined && !validateVec3(data.facing)) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "facing must be [x,y,z] when provided"
      };
    }
    return { ok: true };
  }

  private handleMovePlayerTo(data: Record<string, unknown>): CommandResult {
    if (!validateVec3(data.pos)) {
      return { ok: false, code: "VALIDATION_FAILED", message: "pos must be [x,y,z]" };
    }
    return { ok: true };
  }

  private handleStartKickoff(data: Record<string, unknown>): CommandResult {
    if (data.project_id !== undefined && typeof data.project_id !== "string") {
      return { ok: false, code: "VALIDATION_FAILED", message: "project_id must be a string" };
    }

    if (typeof data.project_id === "string" && !this.state.projects.has(data.project_id)) {
      return { ok: false, code: "NOT_FOUND", message: "project not found" };
    }

    return { ok: true };
  }
}
