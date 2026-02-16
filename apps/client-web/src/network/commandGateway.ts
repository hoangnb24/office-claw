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

type TaskStatus = "planned" | "in_progress" | "blocked" | "done" | "cancelled";
type ProjectStatus = "created" | "planning" | "executing" | "blocked" | "completed" | "archived";

export interface CommandDataMap {
  submit_request: {
    text: string;
    constraints?: Record<string, unknown>;
    attachments?: string[];
  };
  assign_task: {
    task_id: string;
    agent_id: string;
  };
  auto_assign: {
    project_id: string;
  };
  resolve_decision: {
    decision_id: string;
    choice: string;
    note?: string;
  };
  approve_artifact: {
    artifact_id: string;
  };
  request_changes: {
    artifact_id: string;
    instructions: string;
  };
  split_into_tasks: {
    artifact_id: string;
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
    project_id?: string;
  };
  reassign_task: {
    task_id: string;
    to_agent_id: string;
    from_agent_id?: string;
    reason?: string;
    expected_task_status?: TaskStatus;
  };
  cancel_task: {
    task_id: string;
    confirm: true;
    reason?: string;
    expected_task_status?: TaskStatus;
  };
  pause_project: {
    project_id: string;
    reason?: string;
    scope?: "dispatch_only";
    expected_project_status?: ProjectStatus;
  };
  resume_project: {
    project_id: string;
    reason?: string;
    expected_project_status?: ProjectStatus;
  };
  rerun_task: {
    source_task_id: string;
    mode?: "clone_as_new";
    reason?: string;
    constraints_patch?: Record<string, unknown>;
  };
}

export interface CommandSubmission<K extends CommandName = CommandName> {
  commandId: string;
  commandName: K;
  sentAt: number;
}

export type CommandErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_ALLOWED"
  | "INTERNAL";

interface CommandResultEventBase<K extends CommandName = CommandName> {
  commandId: string;
  commandName?: K;
  receivedAt: number;
}

export interface CommandAckEvent<K extends CommandName = CommandName>
  extends CommandResultEventBase<K> {
  kind: "ack";
}

export interface CommandErrorEvent<K extends CommandName = CommandName>
  extends CommandResultEventBase<K> {
  kind: "error";
  code?: CommandErrorCode;
  message?: string;
}

export type CommandResultEvent<K extends CommandName = CommandName> =
  | CommandAckEvent<K>
  | CommandErrorEvent<K>;

export interface CommandGateway {
  sendCommand<K extends CommandName>(
    name: K,
    data: CommandDataMap[K]
  ): CommandSubmission<K> | null;
}
