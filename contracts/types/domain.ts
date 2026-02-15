export type AgentId = `agent_${string}`;
export type ProjectId = `proj_${string}`;
export type TaskId = `task_${string}`;
export type ArtifactId = `art_${string}`;
export type DecisionId = `dec_${string}`;
export type PoiId = `poi_${string}`;

export type ProjectStatus =
  | "created"
  | "planning"
  | "executing"
  | "blocked"
  | "completed"
  | "archived";

export type TaskStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export type DecisionStatus = "open" | "resolved" | "cancelled";

export type ArtifactStatus =
  | "created"
  | "delivered"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "superseded"
  | "archived";

export type AgentState =
  | "IdleAtHome"
  | "WalkingToPOI"
  | "WorkingAtPOI"
  | "InMeeting"
  | "DeliveringArtifact"
  | "SeekingUserDecision"
  | "WalkingToPlayer"
  | "BlockedWaiting";

export interface Agent {
  agent_id: AgentId;
  state: AgentState;
  pos: [number, number, number];
  task_id?: TaskId;
}

export interface Project {
  project_id: ProjectId;
  title: string;
  status: ProjectStatus;
}

export interface Task {
  task_id: TaskId;
  project_id: ProjectId;
  title: string;
  status: TaskStatus;
  assignee?: AgentId;
}

export interface Decision {
  decision_id: DecisionId;
  project_id: ProjectId;
  status: DecisionStatus;
  prompt: string;
  task_id?: TaskId;
}

export interface Artifact {
  artifact_id: ArtifactId;
  project_id: ProjectId;
  type: string;
  status: ArtifactStatus;
  version: number;
  task_id?: TaskId;
  poi_id?: PoiId;
}

export type EnvelopeType =
  | "hello"
  | "hello_ack"
  | "subscribe"
  | "event"
  | "snapshot"
  | "agent_goal"
  | "agent_stream"
  | "chat"
  | "command"
  | "ack"
  | "error"
  | "ping"
  | "pong";

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

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_ALLOWED"
  | "INTERNAL";

export interface Envelope {
  type: EnvelopeType;
  id: string;
  ts: number;
  v: number;
  payload: Record<string, unknown>;
}
