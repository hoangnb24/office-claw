import { useUiStore } from "../state/uiStore";
import { getWorldSocketClient } from "./worldSocketBridge";

export function inboxErrorMicrocopy(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case "VALIDATION_FAILED":
      return "Couldn't submit request. Reason: required request text is missing. Next: enter request text and submit again.";
    case "NOT_ALLOWED":
      return "Couldn't submit request. Reason: requests are not allowed in the current state. Next: wait for the current flow to finish, then retry.";
    case "NOT_FOUND":
      return "Couldn't submit request. Reason: target workflow context is no longer available. Next: refresh state and retry.";
    case "CONFLICT":
      return "Couldn't submit request. Reason: this conflicts with the latest office state. Next: refresh and retry.";
    case "RATE_LIMITED":
      return "Couldn't submit request. Reason: too many requests were sent in a short time. Next: wait briefly and retry.";
    case "INTERNAL":
      return "Couldn't submit request. Reason: server error while processing the command. Next: retry once, then open Event Feed if it persists.";
    default:
      return fallbackMessage ?? "Couldn't submit request. Next: retry and verify connection status.";
  }
}

function setInboxError(message: string) {
  useUiStore.getState().setInboxNotice({
    level: "error",
    message
  });
}

export function dispatchSubmitRequest(text: string): string | null {
  const normalizedText = text.trim();
  if (!normalizedText) {
    setInboxError("Enter a request before submitting.");
    return null;
  }

  const client = getWorldSocketClient();
  if (!client) {
    setInboxError("World connection is not available. Reconnect and retry.");
    return null;
  }

  const commandId = client.sendCommand("submit_request", {
    text: normalizedText
  });
  if (!commandId) {
    setInboxError("Unable to send request command. Reconnect and retry.");
    return null;
  }

  useUiStore.getState().setInboxNotice({
    level: "success",
    message: "Request submitted. Waiting for server acknowledgment."
  });
  return commandId;
}
