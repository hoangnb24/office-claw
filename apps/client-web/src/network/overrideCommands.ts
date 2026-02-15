import { useUiStore } from "../state/uiStore";
import { getWorldSocketClient } from "./worldSocketBridge";

type OverrideCommandName =
  | "reassign_task"
  | "cancel_task"
  | "pause_project"
  | "resume_project"
  | "rerun_task";

function setOverrideError(message: string) {
  useUiStore.getState().setTaskBoardNotice({
    level: "error",
    message
  });
}

function commandLabel(commandName?: string): string {
  switch (commandName) {
    case "reassign_task":
      return "reassign task";
    case "cancel_task":
      return "cancel task";
    case "pause_project":
      return "pause project";
    case "resume_project":
      return "resume project";
    case "rerun_task":
      return "rerun task";
    default:
      return "override";
  }
}

export function overrideErrorMicrocopy(
  commandName?: string,
  code?: string,
  fallbackMessage?: string
): string {
  const label = commandLabel(commandName);
  switch (code) {
    case "VALIDATION_FAILED":
      return `Couldn't ${label}. Reason: required override fields are missing. Next: verify selection and retry.`;
    case "NOT_FOUND":
      return `Couldn't ${label}. Reason: referenced task/project no longer exists. Next: refresh board and retry.`;
    case "CONFLICT":
      return `Couldn't ${label}. Reason: task or project state changed. Next: refresh state and retry with updated status.`;
    case "NOT_ALLOWED":
      return `Couldn't ${label}. Reason: override is not allowed in the current lifecycle state. Next: choose a different action.`;
    case "RATE_LIMITED":
      return `Couldn't ${label}. Reason: too many override actions were sent quickly. Next: wait briefly and retry.`;
    case "INTERNAL":
      return `Couldn't ${label}. Reason: server failed while applying override. Next: retry once; if it persists, use Event Feed for diagnostics.`;
    default:
      return fallbackMessage ?? `Couldn't ${label}. Next: retry and confirm live connection.`;
  }
}

function sendOverrideCommand(
  commandName: OverrideCommandName,
  data: Record<string, unknown>,
  offlineMessage: string,
  sendFailMessage: string
): string | null {
  const client = getWorldSocketClient();
  if (!client) {
    setOverrideError(offlineMessage);
    return null;
  }
  const commandId = client.sendCommand(commandName, data);
  if (!commandId) {
    setOverrideError(sendFailMessage);
    return null;
  }
  return commandId;
}

export function dispatchReassignTask(params: {
  taskId: string;
  toAgentId: string;
  fromAgentId?: string;
  expectedTaskStatus?: "planned" | "in_progress" | "blocked" | "done" | "cancelled";
  reason?: string;
}): string | null {
  const taskId = params.taskId.trim();
  const toAgentId = params.toAgentId.trim();
  if (!taskId || !toAgentId) {
    setOverrideError("Select both task and target agent before reassigning.");
    return null;
  }

  return sendOverrideCommand(
    "reassign_task",
    {
      task_id: taskId,
      to_agent_id: toAgentId,
      from_agent_id: params.fromAgentId,
      expected_task_status: params.expectedTaskStatus,
      reason: params.reason?.trim() || undefined
    },
    "World connection is not available. Reconnect and retry reassign.",
    "Unable to send reassign command. Reconnect and retry."
  );
}

export function dispatchCancelTask(params: {
  taskId: string;
  expectedTaskStatus?: "planned" | "in_progress" | "blocked" | "done" | "cancelled";
  reason?: string;
}): string | null {
  const taskId = params.taskId.trim();
  if (!taskId) {
    setOverrideError("Select a task before cancelling.");
    return null;
  }

  return sendOverrideCommand(
    "cancel_task",
    {
      task_id: taskId,
      confirm: true,
      expected_task_status: params.expectedTaskStatus,
      reason: params.reason?.trim() || undefined
    },
    "World connection is not available. Reconnect and retry cancel.",
    "Unable to send cancel command. Reconnect and retry."
  );
}

export function dispatchPauseProject(params: {
  projectId: string;
  expectedProjectStatus?: "created" | "planning" | "executing" | "blocked" | "completed" | "archived";
  reason?: string;
}): string | null {
  const projectId = params.projectId.trim();
  if (!projectId) {
    setOverrideError("Select a project before pausing dispatch.");
    return null;
  }

  return sendOverrideCommand(
    "pause_project",
    {
      project_id: projectId,
      scope: "dispatch_only",
      expected_project_status: params.expectedProjectStatus,
      reason: params.reason?.trim() || undefined
    },
    "World connection is not available. Reconnect and retry pause.",
    "Unable to send pause command. Reconnect and retry."
  );
}

export function dispatchResumeProject(params: {
  projectId: string;
  expectedProjectStatus?: "created" | "planning" | "executing" | "blocked" | "completed" | "archived";
  reason?: string;
}): string | null {
  const projectId = params.projectId.trim();
  if (!projectId) {
    setOverrideError("Select a project before resuming dispatch.");
    return null;
  }

  return sendOverrideCommand(
    "resume_project",
    {
      project_id: projectId,
      expected_project_status: params.expectedProjectStatus,
      reason: params.reason?.trim() || undefined
    },
    "World connection is not available. Reconnect and retry resume.",
    "Unable to send resume command. Reconnect and retry."
  );
}

export function dispatchRerunTask(params: {
  sourceTaskId: string;
  reason?: string;
}): string | null {
  const sourceTaskId = params.sourceTaskId.trim();
  if (!sourceTaskId) {
    setOverrideError("Select a task before creating a rerun.");
    return null;
  }

  return sendOverrideCommand(
    "rerun_task",
    {
      source_task_id: sourceTaskId,
      mode: "clone_as_new",
      reason: params.reason?.trim() || undefined
    },
    "World connection is not available. Reconnect and retry rerun.",
    "Unable to send rerun command. Reconnect and retry."
  );
}
