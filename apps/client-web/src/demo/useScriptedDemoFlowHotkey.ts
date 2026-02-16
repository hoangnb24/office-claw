import { useEffect, useRef } from "react";
import { useUiStore } from "../state/uiStore";
import { useWorldStore } from "../state/worldStore";
import { dispatchSubmitRequest } from "../network/inboxCommands";
import { dispatchAutoAssign } from "../network/taskBoardCommands";
import { dispatchResolveDecision } from "../network/decisionCommands";
import { dispatchApproveArtifact } from "../network/artifactCommands";

const DEMO_HOTKEY_ENV_FLAG = "VITE_DEMO_FLOW_HOTKEY";
const DEMO_STEP_DELAY_MS = 650;
const DEMO_REQUEST_TEXT = "Demo flow request: validate gateway command loop.";

function isScriptedDemoHotkeyEnabled() {
  return import.meta.env.DEV || import.meta.env[DEMO_HOTKEY_ENV_FLAG] === "1";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
}

function resolveProjectId(): string | null {
  const tasks = Object.values(useWorldStore.getState().tasks);
  if (tasks.length > 0) {
    return tasks[0].projectId;
  }
  const events = useWorldStore.getState().events;
  if (events.length > 0) {
    return events[events.length - 1].projectId;
  }
  return null;
}

function resolveDecisionId(): string | null {
  const decisions = Object.values(useUiStore.getState().decisions);
  const openDecision = decisions
    .filter((decision) => decision.status === "open")
    .sort((left, right) => right.updatedTs - left.updatedTs)[0];
  return openDecision?.decisionId ?? null;
}

function resolveArtifactId(): string | null {
  const artifacts = Object.values(useUiStore.getState().artifacts);
  const reviewableArtifact = artifacts
    .filter((artifact) => artifact.status === "delivered" || artifact.status === "in_review")
    .sort((left, right) => right.updatedTs - left.updatedTs)[0];
  return reviewableArtifact?.artifactId ?? null;
}

export function useScriptedDemoFlowHotkey() {
  const runningRef = useRef(false);
  const activeTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isScriptedDemoHotkeyEnabled()) {
      return;
    }

    const clearTimers = () => {
      for (const timerId of activeTimersRef.current) {
        window.clearTimeout(timerId);
      }
      activeTimersRef.current = [];
    };

    const setNotice = (level: "success" | "error", message: string) => {
      useUiStore.getState().setBdChatNotice({ level, message });
    };

    const runDemoFlow = () => {
      if (runningRef.current) {
        setNotice("error", "Scripted demo flow is already running.");
        return;
      }

      const projectId = resolveProjectId();
      const decisionId = resolveDecisionId();
      const artifactId = resolveArtifactId();

      const steps: Array<() => void> = [
        () => {
          const commandId = dispatchSubmitRequest(DEMO_REQUEST_TEXT);
          if (!commandId) {
            setNotice("error", "Demo flow step submit_request failed.");
          }
        }
      ];

      if (projectId) {
        steps.push(() => {
          const commandId = dispatchAutoAssign(projectId);
          if (!commandId) {
            setNotice("error", "Demo flow step auto_assign failed.");
          }
        });
      }

      if (decisionId) {
        steps.push(() => {
          const commandId = dispatchResolveDecision(decisionId, "Proceed");
          if (!commandId) {
            setNotice("error", "Demo flow step resolve_decision failed.");
          }
        });
      }

      if (artifactId) {
        steps.push(() => {
          const commandId = dispatchApproveArtifact(artifactId);
          if (!commandId) {
            setNotice("error", "Demo flow step approve_artifact failed.");
          }
        });
      }

      runningRef.current = true;
      setNotice(
        "success",
        `Scripted demo flow started (${steps.length} step${steps.length === 1 ? "" : "s"}).`
      );

      clearTimers();
      steps.forEach((step, index) => {
        const timerId = window.setTimeout(() => {
          step();
          if (index === steps.length - 1) {
            runningRef.current = false;
            setNotice("success", "Scripted demo flow completed.");
            activeTimersRef.current = [];
          }
        }, index * DEMO_STEP_DELAY_MS);
        activeTimersRef.current.push(timerId);
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }
      if (!event.altKey || !event.shiftKey || event.key.toLowerCase() !== "d") {
        return;
      }
      runDemoFlow();
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimers();
      runningRef.current = false;
    };
  }, []);
}
