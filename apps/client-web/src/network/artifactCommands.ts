import { useUiStore } from "../state/uiStore";
import { getCommandGateway } from "./worldSocketBridge";

export function artifactErrorMicrocopy(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case "VALIDATION_FAILED":
      return "Couldn't process artifact action. Reason: required fields are missing. Next: verify inputs and retry.";
    case "NOT_FOUND":
      return "Couldn't process artifact action. Reason: artifact no longer exists. Next: refresh snapshot and select another artifact.";
    case "CONFLICT":
      return "Couldn't process artifact action. Reason: artifact state changed and action is no longer valid. Next: refresh artifact status and retry.";
    case "NOT_ALLOWED":
      return "Couldn't process artifact action. Reason: action is not allowed in current workflow state. Next: complete required preconditions and retry.";
    case "RATE_LIMITED":
      return "Couldn't process artifact action. Reason: too many artifact actions were sent quickly. Next: wait briefly and retry.";
    case "INTERNAL":
      return "Couldn't process artifact action. Reason: server error during review handling. Next: retry once, then open Event Feed if it persists.";
    default:
      return fallbackMessage ?? "Couldn't process artifact action. Next: retry and verify live connection.";
  }
}

function setArtifactError(message: string) {
  useUiStore.getState().setArtifactNotice({
    level: "error",
    message
  });
}

export function dispatchApproveArtifact(artifactId: string): string | null {
  const normalizedArtifactId = artifactId.trim();
  if (!normalizedArtifactId) {
    setArtifactError("Select an artifact before approving.");
    return null;
  }

  const gateway = getCommandGateway();
  if (!gateway) {
    setArtifactError("World connection is not available. Reconnect and retry.");
    return null;
  }

  const submission = gateway.sendCommand("approve_artifact", {
    artifact_id: normalizedArtifactId
  });
  if (!submission) {
    setArtifactError("Unable to send approve command. Reconnect and retry.");
    return null;
  }
  return submission.commandId;
}

export function dispatchRequestArtifactChanges(artifactId: string, instructions: string): string | null {
  const normalizedArtifactId = artifactId.trim();
  const normalizedInstructions = instructions.trim();
  if (!normalizedArtifactId || !normalizedInstructions) {
    setArtifactError("Select an artifact and provide change instructions before submitting.");
    return null;
  }

  const gateway = getCommandGateway();
  if (!gateway) {
    setArtifactError("World connection is not available. Reconnect and retry.");
    return null;
  }

  const submission = gateway.sendCommand("request_changes", {
    artifact_id: normalizedArtifactId,
    instructions: normalizedInstructions
  });
  if (!submission) {
    setArtifactError("Unable to send change request command. Reconnect and retry.");
    return null;
  }
  return submission.commandId;
}

export function dispatchSplitArtifactIntoTasks(artifactId: string, taskTitles: string[]): string | null {
  const normalizedArtifactId = artifactId.trim();
  const normalizedTaskTitles = taskTitles
    .map((title) => title.trim())
    .filter((title) => title.length > 0);
  if (!normalizedArtifactId || normalizedTaskTitles.length === 0) {
    setArtifactError("Select an artifact and provide at least one follow-up task title.");
    return null;
  }

  const gateway = getCommandGateway();
  if (!gateway) {
    setArtifactError("World connection is not available. Reconnect and retry.");
    return null;
  }

  const submission = gateway.sendCommand("split_into_tasks", {
    artifact_id: normalizedArtifactId,
    task_titles: normalizedTaskTitles
  });
  if (!submission) {
    setArtifactError("Unable to send split command. Reconnect and retry.");
    return null;
  }
  return submission.commandId;
}
