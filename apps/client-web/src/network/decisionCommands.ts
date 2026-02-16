import { useUiStore } from "../state/uiStore";
import { getCommandGateway } from "./worldSocketBridge";

export function decisionErrorMicrocopy(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case "VALIDATION_FAILED":
      return "Couldn't submit decision. Reason: decision id or choice is missing. Next: select a decision, enter a choice, and retry.";
    case "NOT_FOUND":
      return "Couldn't submit decision. Reason: decision no longer exists. Next: refresh decisions and choose an open item.";
    case "CONFLICT":
      return "Couldn't submit decision. Reason: decision is already resolved. Next: refresh decisions to view latest status.";
    case "NOT_ALLOWED":
      return "Couldn't submit decision. Reason: decision cannot be resolved in current state. Next: follow required flow and retry.";
    case "RATE_LIMITED":
      return "Couldn't submit decision. Reason: too many decision actions were sent quickly. Next: wait briefly and retry.";
    case "INTERNAL":
      return "Couldn't submit decision. Reason: server error while resolving decision. Next: retry once, then open Event Feed if it persists.";
    default:
      return fallbackMessage ?? "Couldn't submit decision. Next: retry and verify live connection.";
  }
}

function setDecisionError(message: string) {
  useUiStore.getState().setDecisionNotice({
    level: "error",
    message
  });
}

export function dispatchResolveDecision(decisionId: string, choice: string): string | null {
  const normalizedDecisionId = decisionId.trim();
  const normalizedChoice = choice.trim();
  if (!normalizedDecisionId || !normalizedChoice) {
    setDecisionError("Select a decision and provide a choice before resolving.");
    return null;
  }

  const gateway = getCommandGateway();
  if (!gateway) {
    setDecisionError("World connection is not available. Reconnect and retry.");
    return null;
  }

  const submission = gateway.sendCommand("resolve_decision", {
    decision_id: normalizedDecisionId,
    choice: normalizedChoice
  });
  if (!submission) {
    setDecisionError("Unable to send resolve command. Reconnect and retry.");
    return null;
  }

  useUiStore.getState().setDecisionNotice({
    level: "success",
    message: "Resolve request sent. Waiting for server acknowledgment."
  });
  return submission.commandId;
}
