import { useUiStore } from "../state/uiStore";
import { getCommandGateway } from "./worldSocketBridge";

export function taskBoardErrorMicrocopy(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case "VALIDATION_FAILED":
      return "Couldn't update task board. Reason: required assignment data is missing. Next: reselect task/assignee and retry.";
    case "NOT_FOUND":
      return "Couldn't update task board. Reason: task or assignee no longer exists. Next: refresh board state and retry.";
    case "CONFLICT":
      return "Couldn't update task board. Reason: action conflicts with latest task state. Next: refresh board and choose another assignment.";
    case "NOT_ALLOWED":
      return "Couldn't update task board. Reason: this action is not allowed right now. Next: complete required preconditions, then retry.";
    case "RATE_LIMITED":
      return "Couldn't update task board. Reason: too many actions were sent in a short time. Next: wait briefly and retry.";
    case "INTERNAL":
      return "Couldn't update task board. Reason: server error while processing assignment. Next: retry once, then open Event Feed if it persists.";
    default:
      return fallbackMessage ?? "Couldn't update task board. Next: retry and verify live connection.";
  }
}

function setLocalError(message: string) {
  useUiStore.getState().setTaskBoardNotice({
    level: "error",
    message
  });
}

export function dispatchAssignTask(taskId: string, agentId: string): string | null {
  const gateway = getCommandGateway();
  if (!gateway) {
    setLocalError("World connection is not available. Reconnect and retry assignment.");
    return null;
  }

  const submission = gateway.sendCommand("assign_task", {
    task_id: taskId,
    agent_id: agentId
  });
  if (!submission) {
    setLocalError("Unable to send assignment command. Reconnect and retry.");
    return null;
  }
  return submission.commandId;
}

export function dispatchAutoAssign(projectId: string): string | null {
  const gateway = getCommandGateway();
  if (!gateway) {
    setLocalError("World connection is not available. Reconnect and retry auto-assign.");
    return null;
  }

  const submission = gateway.sendCommand("auto_assign", {
    project_id: projectId
  });
  if (!submission) {
    setLocalError("Unable to send auto-assign command. Reconnect and retry.");
    return null;
  }
  return submission.commandId;
}
