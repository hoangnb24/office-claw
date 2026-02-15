import type { AgentId, ArtifactId, DecisionId, ProjectId, TaskId } from "./domain";

export type CommandName =
  | "submit_request"
  | "assign_task"
  | "auto_assign"
  | "resolve_decision"
  | "approve_artifact"
  | "request_changes"
  | "split_into_tasks"
  | "player_pos"
  | "move_player_to"
  | "start_kickoff"
  | "reassign_task"
  | "cancel_task"
  | "pause_project"
  | "resume_project"
  | "rerun_task";

export interface CommandDataMap {
  submit_request: {
    text: string;
    constraints?: Record<string, unknown>;
    attachments?: string[];
  };
  assign_task: {
    task_id: TaskId;
    agent_id: AgentId;
  };
  auto_assign: {
    project_id: ProjectId;
  };
  resolve_decision: {
    decision_id: DecisionId;
    choice: string;
    note?: string;
  };
  approve_artifact: {
    artifact_id: ArtifactId;
  };
  request_changes: {
    artifact_id: ArtifactId;
    instructions: string;
  };
  split_into_tasks: {
    artifact_id: ArtifactId;
    task_titles: string[];
  };
  player_pos: {
    pos: [number, number, number];
    facing?: [number, number, number];
  };
  move_player_to: {
    pos: [number, number, number];
    arrival_radius?: number;
  };
  start_kickoff: {
    project_id?: ProjectId;
  };
  reassign_task: {
    task_id: TaskId;
    to_agent_id: AgentId;
    from_agent_id?: AgentId;
    reason?: string;
    expected_task_status?: "planned" | "in_progress" | "blocked" | "done" | "cancelled";
  };
  cancel_task: {
    task_id: TaskId;
    confirm: true;
    reason?: string;
    expected_task_status?: "planned" | "in_progress" | "blocked" | "done" | "cancelled";
  };
  pause_project: {
    project_id: ProjectId;
    reason?: string;
    scope?: "dispatch_only";
    expected_project_status?: "created" | "planning" | "executing" | "blocked" | "completed" | "archived";
  };
  resume_project: {
    project_id: ProjectId;
    reason?: string;
    expected_project_status?: "created" | "planning" | "executing" | "blocked" | "completed" | "archived";
  };
  rerun_task: {
    source_task_id: TaskId;
    mode?: "clone_as_new";
    reason?: string;
    constraints_patch?: Record<string, unknown>;
  };
}

export type CommandPayload<K extends CommandName = CommandName> = {
  name: K;
  data: CommandDataMap[K];
};

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_ALLOWED"
  | "INTERNAL";

export interface AckPayload {
  in_reply_to: string;
  status: "ok";
}

export interface ErrorPayload {
  in_reply_to: string;
  code: ErrorCode;
  message: string;
}

export type UiErrorState =
  | "fix_input"
  | "refresh_state"
  | "choose_alternative"
  | "retry_later"
  | "blocked_by_policy"
  | "retry_or_fallback";

export interface ErrorPolicy {
  code: ErrorCode;
  server_condition: string;
  ui_state: UiErrorState;
  retryable: boolean;
  user_safe_message: string;
}

export const ERROR_POLICIES: Record<ErrorCode, ErrorPolicy> = {
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    server_condition: "Unknown command or malformed payload shape",
    ui_state: "fix_input",
    retryable: false,
    user_safe_message: "That action is missing required information."
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    server_condition: "Referenced entity does not exist in authoritative state",
    ui_state: "refresh_state",
    retryable: true,
    user_safe_message: "That item no longer exists in the current session."
  },
  CONFLICT: {
    code: "CONFLICT",
    server_condition: "Request conflicts with current lifecycle/state transition",
    ui_state: "choose_alternative",
    retryable: true,
    user_safe_message: "That action conflicts with the latest office state."
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    server_condition: "Rate limit exceeded for command/channel",
    ui_state: "retry_later",
    retryable: true,
    user_safe_message: "Too many requests in a short time."
  },
  NOT_ALLOWED: {
    code: "NOT_ALLOWED",
    server_condition: "Caller is not allowed to execute command in current policy/scope",
    ui_state: "blocked_by_policy",
    retryable: false,
    user_safe_message: "This action is not allowed right now."
  },
  INTERNAL: {
    code: "INTERNAL",
    server_condition: "Unhandled server error",
    ui_state: "retry_or_fallback",
    retryable: true,
    user_safe_message: "Something went wrong on the server."
  }
};
