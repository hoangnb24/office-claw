import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useUiStore,
  type ArtifactSnapshot,
  type ArtifactStatus,
  type DecisionSnapshot,
  type PanelId,
  GUIDED_ONBOARDING_STEPS,
  type OnboardingStepId
} from "../state/uiStore";
import {
  useWorldStore,
  type ConnectionStatus,
  type TaskSnapshot,
  type WorldEvent
} from "../state/worldStore";
import { useInteractionStore } from "../state/interactionStore";
import { usePlayerStore } from "../state/playerStore";
import {
  normalizeEditorDraft,
  useSceneEditorStore
} from "../state/sceneEditorStore";
import { dispatchSubmitRequest } from "../network/inboxCommands";
import { dispatchAssignTask, dispatchAutoAssign } from "../network/taskBoardCommands";
import { dispatchResolveDecision } from "../network/decisionCommands";
import {
  dispatchApproveArtifact,
  dispatchRequestArtifactChanges,
  dispatchSplitArtifactIntoTasks
} from "../network/artifactCommands";
import {
  dispatchCancelTask,
  dispatchPauseProject,
  dispatchReassignTask,
  dispatchRerunTask,
  dispatchResumeProject
} from "../network/overrideCommands";
import {
  classifySceneObjectLoadBucket,
  useSceneRuntimeProvider,
  type SceneRuntimeIssue
} from "../scene/runtime";
import type { SceneObjectSpec, ScenePoi } from "../scene/loader";

const panelLabels: Record<PanelId, string> = {
  "event-feed": "Event Feed",
  inbox: "Inbox",
  "bd-chat": "BD Chat",
  "task-board": "Task Board",
  "agent-inspector": "Agent Inspector",
  "artifact-viewer": "Artifact Viewer",
  "decision-panel": "Decisions"
};

const PANEL_SHORTCUTS: Record<string, PanelId> = {
  "1": "event-feed",
  "2": "inbox",
  "3": "bd-chat",
  "4": "task-board",
  "5": "agent-inspector",
  "6": "artifact-viewer",
  "7": "decision-panel"
};

const PANEL_BY_POI: Record<string, PanelId> = {
  poi_reception_inbox: "inbox",
  poi_task_board: "task-board",
  poi_delivery_shelf: "artifact-viewer"
};

const ONBOARDING_FLOW_STEPS: Array<{
  id: OnboardingStepId;
  panelId: PanelId;
  poiId: string | null;
  title: string;
  primary: string;
  secondary: string;
}> = [
  {
    id: "inbox",
    panelId: "inbox",
    poiId: "poi_reception_inbox",
    title: "Step 1: Inbox",
    primary: "Submit your first request in Inbox.",
    secondary: "This seeds kickoff and creates initial tasks."
  },
  {
    id: "task_board",
    panelId: "task-board",
    poiId: "poi_task_board",
    title: "Step 2: Task Board",
    primary: "Review assignments, then drag a task card onto a specialist column or use Auto-Assign.",
    secondary: "Cards are draggable directly from To Do/Doing/Done. Watch the \"Moving ...\" hint while dragging."
  },
  {
    id: "artifact_viewer",
    panelId: "artifact-viewer",
    poiId: "poi_delivery_shelf",
    title: "Step 3: Delivery Shelf",
    primary: "Inspect artifacts and run review actions.",
    secondary: "Approve, request changes, or split into follow-up tasks."
  },
  {
    id: "decision_panel",
    panelId: "decision-panel",
    poiId: null,
    title: "Step 4: Decision Loop",
    primary: "Resolve blockers from the Decisions panel.",
    secondary: "When resolved, blocked work can continue in the task board."
  }
];

function connectionHint(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected. Live world updates are active.";
    case "connecting":
      return "Connecting to world server...";
    case "reconnecting":
      return "Recovering from disconnect. Auto-retry in progress.";
    case "stale":
      return "Connection dropped. Showing last known state until reconnection.";
    case "error":
      return "Connection error detected. Retrying automatically.";
    case "disconnected":
      return "Disconnected. Check server URL or enable auto-connect.";
    case "idle":
    default:
      return "Connection not initialized yet.";
  }
}

function eventTitle(name: string): string {
  return name
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function eventSubtitle(event: WorldEvent): string {
  const details: string[] = [];
  if (event.poiId) {
    details.push(`POI: ${event.poiId}`);
  }
  if (event.agentId) {
    details.push(`Agent: ${event.agentId}`);
  }
  if (event.taskId) {
    details.push(`Task: ${event.taskId}`);
  }
  if (typeof event.meta?.command_name === "string") {
    details.push(`Cmd: ${event.meta.command_name}`);
  }
  if (event.meta?.assignment_mode === "auto") {
    details.push("Auto-assign");
  }
  if (typeof event.meta?.from_agent_id === "string" && typeof event.agentId === "string") {
    details.push(`Move: ${event.meta.from_agent_id} -> ${event.agentId}`);
  }
  if (event.seq !== null) {
    details.push(`Seq: ${event.seq}`);
  }
  return details.join(" • ");
}

function resolveEventFocusPoi(event: WorldEvent): string | null {
  if (event.poiId) {
    return event.poiId;
  }

  const commandName =
    typeof event.meta?.command_name === "string" ? event.meta.command_name : null;
  const taskToken = typeof event.taskId === "string" ? event.taskId.toLowerCase() : "";

  if (event.name === "snapshot_correction") {
    if (
      taskToken.includes("wireframe") ||
      taskToken.includes("artifact") ||
      taskToken.includes("delivery")
    ) {
      return "poi_delivery_shelf";
    }
    return "poi_task_board";
  }

  if (event.artifactId || event.name.startsWith("review_")) {
    return "poi_delivery_shelf";
  }
  if (
    taskToken.includes("wireframe") ||
    taskToken.includes("artifact") ||
    taskToken.includes("delivery")
  ) {
    return "poi_delivery_shelf";
  }
  if (commandName === "submit_request") {
    return "poi_reception_inbox";
  }
  if (
    event.taskId ||
    event.decisionId ||
    event.name.startsWith("task_") ||
    event.name.startsWith("decision_")
  ) {
    return "poi_task_board";
  }
  return null;
}

function isSnapshotCorrectionEvent(event: WorldEvent): boolean {
  return event.name === "snapshot_correction";
}

function resolveEventFocusAgent(
  event: WorldEvent,
  taskLookup: Record<string, TaskSnapshot>
): string | null {
  if (event.agentId) {
    return event.agentId;
  }

  if (typeof event.meta?.to_agent_id === "string" && event.meta.to_agent_id.trim()) {
    return event.meta.to_agent_id;
  }
  if (typeof event.meta?.agent_id === "string" && event.meta.agent_id.trim()) {
    return event.meta.agent_id;
  }

  if (event.taskId) {
    const taskAssignee = taskLookup[event.taskId]?.assignee;
    if (typeof taskAssignee === "string" && taskAssignee.trim()) {
      return taskAssignee;
    }
  }

  const preferredParticipant =
    event.participants.find((participant) => participant !== "agent_bd") ??
    event.participants[0] ??
    null;
  return preferredParticipant;
}

function eventTimeLabel(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function titleFromToken(token: string): string {
  return token
    .split(/[_-]/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

interface PoiUiHints {
  ui?: {
    label?: string;
    tooltip?: string;
    cursor?: string;
    affordance?: string;
  };
}

function affordanceLabelForPoi(poi: ScenePoi): string {
  const uiLabel = (poi as ScenePoi & PoiUiHints).ui?.label;
  if (typeof uiLabel === "string" && uiLabel.trim().length > 0) {
    return uiLabel.trim();
  }

  const panelToken = poi.interaction?.panel;
  if (typeof panelToken === "string" && panelToken.trim().length > 0) {
    return titleFromToken(panelToken);
  }

  if (typeof poi.type === "string" && poi.type.trim().length > 0) {
    return titleFromToken(poi.type);
  }

  return titleFromToken(poi.poi_id.replace(/^poi_/, ""));
}

function affordanceTooltipForPoi(poi: ScenePoi, label: string): string {
  const uiTooltip = (poi as ScenePoi & PoiUiHints).ui?.tooltip;
  if (typeof uiTooltip === "string" && uiTooltip.trim().length > 0) {
    return uiTooltip.trim();
  }

  const interactionType = poi.interaction?.type;
  if (interactionType === "open_panel") {
    return `Open ${label}`;
  }
  if (interactionType === "focus_only") {
    return `Focus ${label}`;
  }
  if (interactionType === "command") {
    return `Run interaction for ${label}`;
  }
  return `Interact with ${label}`;
}

function roleLabel(agentId: string): string {
  const normalized = agentId.trim().toLowerCase();
  if (normalized === "agent_bd" || normalized.endsWith("_bd")) {
    return "Business Director";
  }
  if (normalized.includes("qa")) {
    return "QA Specialist";
  }
  if (normalized.includes("design")) {
    return "Design Specialist";
  }
  if (normalized.includes("eng") || normalized.includes("dev")) {
    return "Engineering Specialist";
  }
  return "Specialist";
}

function taskWhyHint(taskId: string, taskStatus: string, assignee: string | undefined, events: WorldEvent[]): string {
  const trace = [...events].reverse().find((event) => event.taskId === taskId);
  if (trace) {
    if (trace.name === "task_assigned") {
      const assignedAgent =
        typeof trace.agentId === "string"
          ? trace.agentId
          : typeof trace.meta?.to_agent_id === "string"
            ? trace.meta.to_agent_id
            : assignee;
      return assignedAgent
        ? `Why: assigned to ${assignedAgent} (${eventTimeLabel(trace.ts)})`
        : `Why: assignment updated (${eventTimeLabel(trace.ts)})`;
    }
    if (trace.name === "decision_requested" || trace.name === "task_blocked") {
      return trace.decisionId
        ? `Why: blocked pending ${trace.decisionId}`
        : "Why: blocked pending user decision";
    }
    if (trace.name === "decision_resolved") {
      return "Why: decision resolved, work resumed";
    }
    if (trace.name === "task_done") {
      return "Why: completion event confirmed";
    }
    if (trace.name === "task_cancelled") {
      return "Why: task was cancelled by override";
    }
    return `Why: ${eventTitle(trace.name)} (${eventTimeLabel(trace.ts)})`;
  }

  if (taskStatus === "planned") {
    return assignee ? "Why: queued for assigned specialist" : "Why: waiting for assignment";
  }
  if (taskStatus === "in_progress") {
    return "Why: active execution in progress";
  }
  if (taskStatus === "blocked") {
    return "Why: waiting on unblock signal";
  }
  if (taskStatus === "done") {
    return "Why: marked complete by server lifecycle";
  }
  return "Why: terminal task state";
}

function latestTraceEventFor(params: {
  events: WorldEvent[];
  taskId?: string;
  artifactId?: string;
  decisionId?: string;
}): WorldEvent | null {
  const { events, taskId, artifactId, decisionId } = params;
  const trace = [...events].reverse().find((event) => {
    if (taskId && event.taskId === taskId) {
      return true;
    }
    if (artifactId && event.artifactId === artifactId) {
      return true;
    }
    if (decisionId && event.decisionId === decisionId) {
      return true;
    }
    return false;
  });
  return trace ?? null;
}

function needLabels(params: {
  state: string;
  taskStatus: string | null;
  decisionId: string | null;
}): string[] {
  const needs: string[] = [];
  if (params.taskStatus === "blocked" || params.state === "blocked") {
    needs.push(params.decisionId ? `Needs decision ${params.decisionId}` : "Needs unblock decision");
  }
  if (params.taskStatus === "planned") {
    needs.push("Needs task kickoff");
  }
  if (params.state === "idle" && !params.taskStatus) {
    needs.push("Needs assignment");
  }
  if (params.state === "meeting") {
    needs.push("Needs sync outcome");
  }
  return needs;
}

const ARTIFACT_SORT_PRIORITY: Record<ArtifactStatus, number> = {
  in_review: 0,
  delivered: 1,
  changes_requested: 2,
  created: 3,
  approved: 4,
  superseded: 5,
  archived: 6
};

const REVIEWABLE_ARTIFACT_STATUSES = new Set<ArtifactStatus>([
  "delivered",
  "in_review",
  "changes_requested"
]);

function compareArtifactsForPanel(a: ArtifactSnapshot, b: ArtifactSnapshot): number {
  const byPriority = ARTIFACT_SORT_PRIORITY[a.status] - ARTIFACT_SORT_PRIORITY[b.status];
  if (byPriority !== 0) {
    return byPriority;
  }
  const byVersion = b.version - a.version;
  if (byVersion !== 0) {
    return byVersion;
  }
  return b.updatedTs - a.updatedTs;
}

interface PrimaryProjectScore {
  activeTasks: number;
  openDecisions: number;
  reviewableArtifacts: number;
  totalTasks: number;
  totalDecisions: number;
  totalArtifacts: number;
  lastActivityTs: number;
}

function pickPrimaryProjectId(params: {
  tasks: TaskSnapshot[];
  decisions: DecisionSnapshot[];
  artifacts: ArtifactSnapshot[];
  events: WorldEvent[];
}): string | null {
  const scores = new Map<string, PrimaryProjectScore>();

  const ensureScore = (projectId: string): PrimaryProjectScore => {
    const existing = scores.get(projectId);
    if (existing) {
      return existing;
    }
    const next: PrimaryProjectScore = {
      activeTasks: 0,
      openDecisions: 0,
      reviewableArtifacts: 0,
      totalTasks: 0,
      totalDecisions: 0,
      totalArtifacts: 0,
      lastActivityTs: 0
    };
    scores.set(projectId, next);
    return next;
  };

  for (const task of params.tasks) {
    const score = ensureScore(task.projectId);
    score.totalTasks += 1;
    if (task.status === "planned" || task.status === "in_progress" || task.status === "blocked") {
      score.activeTasks += 1;
    }
  }

  for (const decision of params.decisions) {
    const score = ensureScore(decision.projectId);
    score.totalDecisions += 1;
    if (decision.status === "open") {
      score.openDecisions += 1;
    }
    score.lastActivityTs = Math.max(score.lastActivityTs, decision.updatedTs);
  }

  for (const artifact of params.artifacts) {
    const score = ensureScore(artifact.projectId);
    score.totalArtifacts += 1;
    if (REVIEWABLE_ARTIFACT_STATUSES.has(artifact.status)) {
      score.reviewableArtifacts += 1;
    }
    score.lastActivityTs = Math.max(score.lastActivityTs, artifact.updatedTs);
  }

  for (const event of params.events) {
    const score = ensureScore(event.projectId);
    score.lastActivityTs = Math.max(score.lastActivityTs, event.ts);
  }

  const ranked = [...scores.entries()].sort(([leftProjectId, left], [rightProjectId, right]) => {
    if (right.activeTasks !== left.activeTasks) {
      return right.activeTasks - left.activeTasks;
    }
    if (right.openDecisions !== left.openDecisions) {
      return right.openDecisions - left.openDecisions;
    }
    if (right.reviewableArtifacts !== left.reviewableArtifacts) {
      return right.reviewableArtifacts - left.reviewableArtifacts;
    }
    if (right.totalTasks !== left.totalTasks) {
      return right.totalTasks - left.totalTasks;
    }
    if (right.totalDecisions !== left.totalDecisions) {
      return right.totalDecisions - left.totalDecisions;
    }
    if (right.totalArtifacts !== left.totalArtifacts) {
      return right.totalArtifacts - left.totalArtifacts;
    }
    if (right.lastActivityTs !== left.lastActivityTs) {
      return right.lastActivityTs - left.lastActivityTs;
    }
    return leftProjectId.localeCompare(rightProjectId);
  });

  return ranked[0]?.[0] ?? null;
}

function cancelConfirmationVersion(task: TaskSnapshot): string {
  return `${task.projectId}|${task.status}|${task.assignee ?? ""}`;
}

function fmt(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function roundTransformValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatTransformTuple(tuple: [number, number, number]): string {
  return `[${roundTransformValue(tuple[0]).toFixed(3)}, ${roundTransformValue(tuple[1]).toFixed(3)}, ${roundTransformValue(tuple[2]).toFixed(3)}]`;
}

interface SceneLoadPolicySummary {
  criticalTotal: number;
  criticalLoaded: number;
  decorTotal: number;
  decorLoaded: number;
}

function summarizeSceneLoadPolicy(params: {
  manifestObjects: SceneObjectSpec[];
  loadedObjectIds: Set<string>;
}): SceneLoadPolicySummary {
  const criticalIds: string[] = [];
  const decorIds: string[] = [];

  for (const object of params.manifestObjects) {
    const bucket = classifySceneObjectLoadBucket(object);
    if (bucket === "critical") {
      criticalIds.push(object.id);
    } else {
      decorIds.push(object.id);
    }
  }

  const criticalLoaded = criticalIds.filter((objectId) => params.loadedObjectIds.has(objectId)).length;
  const decorLoaded = decorIds.filter((objectId) => params.loadedObjectIds.has(objectId)).length;
  return {
    criticalTotal: criticalIds.length,
    criticalLoaded,
    decorTotal: decorIds.length,
    decorLoaded
  };
}

function runtimeStatusClass(status: "idle" | "loading" | "loaded" | "degraded" | "error"): string {
  if (status === "error") {
    return "status-error";
  }
  if (status === "degraded" || status === "loading") {
    return "status-warning";
  }
  return "status-ok";
}

function runtimeIssueActionHint(issue: SceneRuntimeIssue): string {
  switch (issue.code) {
    case "manifest_fetch_failed":
      return "Action: verify manifest URL/server availability, then reload scene.";
    case "manifest_parse_failed":
      return "Action: fix scene JSON structure/values to satisfy parser expectations, then reload.";
    case "manifest_version_invalid":
      return "Action: update manifest contract fields and version to schema-compliant values.";
    case "asset_load_failed":
      return "Action: verify shell/object GLB URLs under /assets and retry scene reload.";
    case "asset_object_load_warnings":
      return "Action: review missing object assets; placeholders may be active for non-critical objects.";
    case "nav_anchor_issues_detected":
      return "Action: adjust nav anchors/collider blockers, then reload to verify reachability.";
    case "invalid_load_options":
      return "Action: ensure scene id and manifest URL are provided before loading runtime scene.";
    default:
      return "Action: open Debug HUD for full diagnostics and retry reload after changes.";
  }
}

type PanelStateKind = "loading" | "empty" | "error";

interface PanelStateMessageProps {
  kind: PanelStateKind;
  primary: string;
  secondary: string;
  actionLabel?: string;
  onAction?: () => void;
}

function PanelStateMessage({
  kind,
  primary,
  secondary,
  actionLabel,
  onAction
}: PanelStateMessageProps) {
  const statusClass = kind === "error" ? "status-error" : kind === "loading" ? "status-warning" : "status-ok";
  return (
    <div className={`panel-state panel-state-${kind}`}>
      <p className={statusClass}><strong>{primary}</strong></p>
      <p>{secondary}</p>
      {actionLabel && onAction ? (
        <div className="panel-state-actions">
          <button type="button" onClick={onAction}>{actionLabel}</button>
        </div>
      ) : null}
    </div>
  );
}

export function OverlayRoot() {
  const openPanels = useUiStore((state) => state.openPanels);
  const firstRunHelpVisible = useUiStore((state) => state.firstRunHelpVisible);
  const guidedOnboardingActive = useUiStore((state) => state.guidedOnboardingActive);
  const guidedOnboardingStepIndex = useUiStore((state) => state.guidedOnboardingStepIndex);
  const guidedOnboardingMetrics = useUiStore((state) => state.guidedOnboardingMetrics);
  const openPanel = useUiStore((state) => state.openPanel);
  const closePanel = useUiStore((state) => state.closePanel);
  const dismissFirstRunHelp = useUiStore((state) => state.dismissFirstRunHelp);
  const reopenFirstRunHelp = useUiStore((state) => state.reopenFirstRunHelp);
  const startGuidedOnboarding = useUiStore((state) => state.startGuidedOnboarding);
  const setGuidedOnboardingStep = useUiStore((state) => state.setGuidedOnboardingStep);
  const completeGuidedOnboarding = useUiStore((state) => state.completeGuidedOnboarding);
  const skipGuidedOnboarding = useUiStore((state) => state.skipGuidedOnboarding);
  const replayGuidedOnboarding = useUiStore((state) => state.replayGuidedOnboarding);
  const focusedPoiId = useUiStore((state) => state.focusedPoiId);
  const focusedAgentId = useUiStore((state) => state.focusedAgentId);
  const focusedPoiScreenAnchor = useUiStore((state) => state.focusedPoiScreenAnchor);
  const reducedMotionEnabled = useUiStore((state) => state.reducedMotionEnabled);
  const setReducedMotionEnabled = useUiStore((state) => state.setReducedMotionEnabled);
  const debugHudEnabled = useUiStore((state) => state.debugHudEnabled);
  const setDebugHudEnabled = useUiStore((state) => state.setDebugHudEnabled);
  const showPathOverlay = useUiStore((state) => state.showPathOverlay);
  const setShowPathOverlay = useUiStore((state) => state.setShowPathOverlay);
  const showBlockedCellsOverlay = useUiStore((state) => state.showBlockedCellsOverlay);
  const setShowBlockedCellsOverlay = useUiStore((state) => state.setShowBlockedCellsOverlay);
  const showAnchorIssueOverlay = useUiStore((state) => state.showAnchorIssueOverlay);
  const setShowAnchorIssueOverlay = useUiStore((state) => state.setShowAnchorIssueOverlay);
  const setFocusedPoi = useUiStore((state) => state.setFocusedPoi);
  const setFocusedAgent = useUiStore((state) => state.setFocusedAgent);
  const inboxNotice = useUiStore((state) => state.inboxNotice);
  const setInboxNotice = useUiStore((state) => state.setInboxNotice);
  const bdChatMessages = useUiStore((state) => state.bdChatMessages);
  const bdChatNotice = useUiStore((state) => state.bdChatNotice);
  const setBdChatNotice = useUiStore((state) => state.setBdChatNotice);
  const taskBoardNotice = useUiStore((state) => state.taskBoardNotice);
  const setTaskBoardNotice = useUiStore((state) => state.setTaskBoardNotice);
  const taskDragGhost = useUiStore((state) => state.taskDragGhost);
  const setTaskDragGhost = useUiStore((state) => state.setTaskDragGhost);
  const artifacts = useUiStore((state) => Object.values(state.artifacts));
  const focusedArtifactId = useUiStore((state) => state.focusedArtifactId);
  const setFocusedArtifact = useUiStore((state) => state.setFocusedArtifact);
  const artifactNotice = useUiStore((state) => state.artifactNotice);
  const setArtifactNotice = useUiStore((state) => state.setArtifactNotice);
  const decisionNotice = useUiStore((state) => state.decisionNotice);
  const setDecisionNotice = useUiStore((state) => state.setDecisionNotice);
  const focusedDecisionId = useUiStore((state) => state.focusedDecisionId);
  const setFocusedDecision = useUiStore((state) => state.setFocusedDecision);
  const decisions = useUiStore((state) => Object.values(state.decisions));

  const sceneRuntime = useSceneRuntimeProvider();
  const [sceneRuntimeReloadPending, setSceneRuntimeReloadPending] = useState(false);
  const [sceneRuntimeNotice, setSceneRuntimeNotice] = useState<string | null>(null);
  const [sceneEditorNotice, setSceneEditorNotice] = useState<string | null>(null);
  const world = useWorldStore();
  const interaction = useInteractionStore();
  const player = usePlayerStore();
  const sceneEditorEnabled = useSceneEditorStore((state) => state.enabled);
  const setSceneEditorEnabled = useSceneEditorStore((state) => state.setEnabled);
  const sceneEditorActiveObjectId = useSceneEditorStore((state) => state.activeObjectId);
  const setSceneEditorActiveObjectId = useSceneEditorStore((state) => state.setActiveObjectId);
  const sceneEditorDraftsByObjectId = useSceneEditorStore((state) => state.draftsByObjectId);
  const ensureSceneEditorDraft = useSceneEditorStore((state) => state.ensureDraft);
  const replaceSceneEditorDraft = useSceneEditorStore((state) => state.replaceDraft);
  const nudgeSceneEditorActive = useSceneEditorStore((state) => state.nudgeActive);
  const clearSceneEditorDraft = useSceneEditorStore((state) => state.clearDraft);
  const clearAllSceneEditorDrafts = useSceneEditorStore((state) => state.clearAllDrafts);
  const manifestPois = sceneRuntime.snapshot.manifest?.pois ?? [];
  const manifestObjects = sceneRuntime.snapshot.manifest?.objects ?? [];
  const loadedRuntimeObjectIds = useMemo(
    () => new Set((sceneRuntime.snapshot.runtimeData?.objects ?? []).map((object) => object.id)),
    [sceneRuntime.snapshot.runtimeData]
  );
  const sceneLoadPolicy = useMemo(
    () =>
      summarizeSceneLoadPolicy({
        manifestObjects,
        loadedObjectIds: loadedRuntimeObjectIds
      }),
    [loadedRuntimeObjectIds, manifestObjects]
  );
  const sceneRuntimeIssues = sceneRuntime.snapshot.issues;
  const visibleSceneRuntimeIssues = sceneRuntimeIssues.slice(0, 3);
  const selectedManifestObjectForEditor = useMemo(() => {
    if (!interaction.selectedId) {
      return null;
    }
    if (interaction.selectedType === "object") {
      return manifestObjects.find((object) => object.id === interaction.selectedId) ?? null;
    }
    if (interaction.selectedType === "poi" || interaction.selectedType === "artifact") {
      return manifestObjects.find((object) => object.poi_id === interaction.selectedId) ?? null;
    }
    return null;
  }, [interaction.selectedId, interaction.selectedType, manifestObjects]);
  const hoveredManifestObjectForEditor = useMemo(() => {
    if (!interaction.hoveredId) {
      return null;
    }
    if (interaction.hoveredType === "object") {
      return manifestObjects.find((object) => object.id === interaction.hoveredId) ?? null;
    }
    if (interaction.hoveredType === "poi" || interaction.hoveredType === "artifact") {
      return manifestObjects.find((object) => object.poi_id === interaction.hoveredId) ?? null;
    }
    return null;
  }, [interaction.hoveredId, interaction.hoveredType, manifestObjects]);
  const sceneEditorCandidateObject = selectedManifestObjectForEditor ?? hoveredManifestObjectForEditor;
  const sceneEditorActiveObject =
    sceneEditorActiveObjectId
      ? manifestObjects.find((object) => object.id === sceneEditorActiveObjectId) ?? null
      : null;
  const sceneEditorActiveDraft =
    sceneEditorActiveObjectId ? sceneEditorDraftsByObjectId[sceneEditorActiveObjectId] ?? null : null;
  const reloadSceneRuntime = useCallback(async () => {
    setSceneRuntimeReloadPending(true);
    setSceneRuntimeNotice(null);
    try {
      await sceneRuntime.reloadScene();
      setSceneRuntimeNotice("Scene runtime reloaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scene reload failure.";
      setSceneRuntimeNotice(`Reload failed: ${message}`);
    } finally {
      setSceneRuntimeReloadPending(false);
    }
  }, [sceneRuntime]);
  const selectSceneEditorObject = useCallback(
    (object: SceneObjectSpec | null) => {
      if (!object) {
        return;
      }
      ensureSceneEditorDraft(object.id, normalizeEditorDraft(object.transform));
      setSceneEditorActiveObjectId(object.id);
      setSceneEditorNotice(`Editing ${object.id}`);
    },
    [ensureSceneEditorDraft, setSceneEditorActiveObjectId]
  );
  const copySceneEditorPatch = useCallback(async () => {
    if (!sceneEditorActiveObject || !sceneEditorActiveDraft) {
      setSceneEditorNotice("No active object draft to copy.");
      return;
    }

    const snippet = JSON.stringify(
      {
        id: sceneEditorActiveObject.id,
        transform: {
          pos: sceneEditorActiveDraft.pos.map(roundTransformValue),
          rot: sceneEditorActiveDraft.rot.map(roundTransformValue),
          scale: sceneEditorActiveDraft.scale.map(roundTransformValue)
        }
      },
      null,
      2
    );

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
        setSceneEditorNotice(`Copied transform patch for ${sceneEditorActiveObject.id}.`);
        return;
      }
      setSceneEditorNotice("Clipboard API unavailable. Copy from the JSON preview.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "clipboard error";
      setSceneEditorNotice(`Copy failed: ${message}`);
    }
  }, [sceneEditorActiveDraft, sceneEditorActiveObject]);
  const placeSceneEditorObjectAtPointerXZ = useCallback(() => {
    if (!sceneEditorActiveObject || !sceneEditorActiveDraft || !interaction.pointerWorldPos) {
      setSceneEditorNotice("Need an active object and a scene pointer location.");
      return;
    }
    replaceSceneEditorDraft(sceneEditorActiveObject.id, {
      ...sceneEditorActiveDraft,
      pos: [
        interaction.pointerWorldPos[0],
        sceneEditorActiveDraft.pos[1],
        interaction.pointerWorldPos[2]
      ]
    });
    setSceneEditorNotice(`Placed ${sceneEditorActiveObject.id} to pointer X/Z.`);
  }, [
    interaction.pointerWorldPos,
    replaceSceneEditorDraft,
    sceneEditorActiveDraft,
    sceneEditorActiveObject
  ]);
  const resetSceneEditorActiveToManifest = useCallback(() => {
    if (!sceneEditorActiveObject) {
      setSceneEditorNotice("No active object selected.");
      return;
    }
    replaceSceneEditorDraft(sceneEditorActiveObject.id, normalizeEditorDraft(sceneEditorActiveObject.transform));
    setSceneEditorNotice(`Reset ${sceneEditorActiveObject.id} to manifest transform.`);
  }, [replaceSceneEditorDraft, sceneEditorActiveObject]);
  const hoveredPoi =
    interaction.hoveredType === "poi" || interaction.hoveredType === "artifact"
      ? manifestPois.find((poi) => poi.poi_id === interaction.hoveredId) ?? null
      : null;
  const focusedPoi =
    focusedPoiId ? manifestPois.find((poi) => poi.poi_id === focusedPoiId) ?? null : null;
  const hoveredAffordance = hoveredPoi
    ? (() => {
        const label = affordanceLabelForPoi(hoveredPoi);
        return {
          label,
          tooltip: affordanceTooltipForPoi(hoveredPoi, label)
        };
      })()
    : null;
  const focusedAffordanceLabel = focusedPoi ? affordanceLabelForPoi(focusedPoi) : null;

  const processedAssets = world.assetStartup.loaded + world.assetStartup.failed;
  const hasCriticalAssetFailure = world.assetStartup.criticalFailed > 0;
  const debugHudProfileEnabled =
    import.meta.env.DEV ||
    import.meta.env.VITE_DEBUG_HUD === "1" ||
    import.meta.env.VITE_NAV_DEBUG === "1";
  const anchoredPanelId = focusedPoiId ? PANEL_BY_POI[focusedPoiId] ?? null : null;
  const events = world.events;
  const prioritizedEvents = useMemo(() => {
    const ordered = [...events].reverse();
    const primary: WorldEvent[] = [];
    const secondary: WorldEvent[] = [];
    for (const event of ordered) {
      if (isSnapshotCorrectionEvent(event)) {
        secondary.push(event);
      } else {
        primary.push(event);
      }
    }
    return [...primary, ...secondary];
  }, [events]);
  const tasks = Object.values(world.tasks);
  const taskLookup = world.tasks;
  const agents = Object.values(world.agents);
  const bdMainMessages = bdChatMessages.filter((message) => message.threadId === "bd_main");
  const hasSnapshotData = world.lastSnapshotId !== null;
  const isConnectionLoading =
    world.connectionStatus === "connecting" ||
    world.connectionStatus === "reconnecting" ||
    (world.connectionStatus === "connected" && !hasSnapshotData);
  const hasConnectionIssue =
    world.connectionStatus === "stale" ||
    world.connectionStatus === "error" ||
    world.connectionStatus === "disconnected";
  const focusedAgent = focusedAgentId ? world.agents[focusedAgentId] ?? null : null;
  const inspectorAgent = focusedAgent ?? agents[0] ?? null;
  const inspectorTask = inspectorAgent
    ? (inspectorAgent.taskId ? world.tasks[inspectorAgent.taskId] : undefined) ??
      tasks.find(
        (task) =>
          task.assignee === inspectorAgent.id &&
          (task.status === "planned" || task.status === "in_progress" || task.status === "blocked")
      )
    : undefined;
  const inspectorEvents = inspectorAgent
    ? events.filter(
        (event) =>
          event.agentId === inspectorAgent.id ||
          event.participants.includes(inspectorAgent.id) ||
          (inspectorTask ? event.taskId === inspectorTask.id : false)
      )
    : [];
  const inspectorDecisionId =
    inspectorEvents
      .slice()
      .reverse()
      .find((event) => typeof event.decisionId === "string")
      ?.decisionId ?? null;
  const inspectorNeeds = inspectorAgent
    ? needLabels({
        state: inspectorAgent.state,
        taskStatus: inspectorTask?.status ?? null,
        decisionId: inspectorDecisionId
      })
    : [];
  const inspectorTraceEvent = inspectorEvents.length > 0 ? inspectorEvents[inspectorEvents.length - 1] : null;
  const openDecisions = decisions.filter((decision) => decision.status === "open");
  const resolvedDecisions = decisions.filter((decision) => decision.status === "resolved");
  const sortedArtifacts = artifacts.slice().sort(compareArtifactsForPanel);
  const activeProjectId = pickPrimaryProjectId({
    tasks,
    decisions,
    artifacts: sortedArtifacts,
    events
  });
  const reviewableArtifacts = sortedArtifacts.filter((artifact) =>
    REVIEWABLE_ARTIFACT_STATUSES.has(artifact.status)
  );
  const historicalArtifacts = sortedArtifacts.filter(
    (artifact) => !REVIEWABLE_ARTIFACT_STATUSES.has(artifact.status)
  );
  const focusedArtifact =
    (focusedArtifactId
      ? sortedArtifacts.find((artifact) => artifact.artifactId === focusedArtifactId)
      : null) ??
    reviewableArtifacts[0] ??
    historicalArtifacts[0] ??
    null;
  const artifactActionsEnabled = focusedArtifact
    ? REVIEWABLE_ARTIFACT_STATUSES.has(focusedArtifact.status)
    : false;
  const focusedArtifactTask =
    focusedArtifact?.taskId ? taskLookup[focusedArtifact.taskId] ?? null : null;
  const focusedArtifactTraceEvent = focusedArtifact
    ? latestTraceEventFor({
        events,
        artifactId: focusedArtifact.artifactId,
        taskId: focusedArtifact.taskId
      })
    : null;
  const focusedDecision =
    (focusedDecisionId ? decisions.find((decision) => decision.decisionId === focusedDecisionId) : null) ??
    openDecisions[0] ??
    resolvedDecisions[0] ??
    null;
  const [requestText, setRequestText] = useState("");
  const [changeInstructions, setChangeInstructions] = useState("");
  const [splitTaskTitlesInput, setSplitTaskTitlesInput] = useState("");
  const [decisionChoice, setDecisionChoice] = useState("");
  const [pendingCancelTask, setPendingCancelTask] = useState<{
    taskId: string;
    expectedVersion: string;
  } | null>(null);
  const firstRunHelpRef = useRef<HTMLElement | null>(null);
  const onboardingStep = ONBOARDING_FLOW_STEPS[
    Math.max(0, Math.min(guidedOnboardingStepIndex, ONBOARDING_FLOW_STEPS.length - 1))
  ];
  const onboardingVisitSummary = GUIDED_ONBOARDING_STEPS.map(
    (stepId) => `${stepId}:${guidedOnboardingMetrics.stepVisits[stepId]}`
  ).join(" ");

  const activateOnboardingStep = (index: number, options?: { updateMetric?: boolean }) => {
    const boundedIndex = Math.max(0, Math.min(index, ONBOARDING_FLOW_STEPS.length - 1));
    const step = ONBOARDING_FLOW_STEPS[boundedIndex];
    if (options?.updateMetric !== false) {
      setGuidedOnboardingStep(boundedIndex, step.id);
    }
    openPanel(step.panelId);
    if (step.poiId) {
      setFocusedPoi(step.poiId);
    } else {
      setFocusedPoi(null);
    }
  };

  const beginGuidedOnboarding = () => {
    const firstStep = ONBOARDING_FLOW_STEPS[0];
    startGuidedOnboarding(firstStep.id);
    openPanel(firstStep.panelId);
    if (firstStep.poiId) {
      setFocusedPoi(firstStep.poiId);
    }
  };

  const skipGuidedFlow = () => {
    skipGuidedOnboarding(onboardingStep.id);
    dismissFirstRunHelp();
  };

  const finishGuidedFlow = () => {
    completeGuidedOnboarding();
    dismissFirstRunHelp();
    openPanel("event-feed");
  };

  const trapOnboardingFocus = (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
    if (event.key !== "Tab" || !guidedOnboardingActive) {
      return;
    }
    const container = firstRunHelpRef.current;
    if (!container) {
      return;
    }
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length < 2) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  };

  const traceTaskToTimeline = (taskId: string) => {
    const trace = latestTraceEventFor({ events, taskId });
    openPanel("event-feed");
    if (trace?.agentId) {
      setFocusedAgent(trace.agentId);
      openPanel("agent-inspector");
    }
    if (trace?.decisionId) {
      setFocusedDecision(trace.decisionId);
      openPanel("decision-panel");
    }
    if (trace?.artifactId) {
      setFocusedArtifact(trace.artifactId);
      openPanel("artifact-viewer");
    }
    setTaskBoardNotice({
      level: "success",
      message: trace
        ? `Trace linked to ${eventTitle(trace.name)} at ${eventTimeLabel(trace.ts)}.`
        : "No timeline event found yet for this task."
    });
  };

  const traceArtifactToTimeline = (artifactId: string, taskId?: string) => {
    const trace = latestTraceEventFor({ events, artifactId, taskId });
    openPanel("event-feed");
    if (trace?.taskId) {
      setTaskBoardNotice({
        level: "success",
        message: `Trace linked to ${eventTitle(trace.name)} at ${eventTimeLabel(trace.ts)}.`
      });
      openPanel("task-board");
    }
    if (trace?.decisionId) {
      setFocusedDecision(trace.decisionId);
      openPanel("decision-panel");
    }
    if (trace?.agentId) {
      setFocusedAgent(trace.agentId);
      openPanel("agent-inspector");
    }
  };

  const runBdSuggestedAction = (action: string, label: string) => {
    if (!action.trim()) {
      return;
    }
    setBdChatNotice(null);
    switch (action) {
      case "open_task_board":
        openPanel("task-board");
        setFocusedPoi("poi_task_board");
        setBdChatNotice({
          level: "success",
          message: `Opened Task Board for "${label}".`
        });
        return;
      case "auto_assign": {
        const projectId = activeProjectId;
        if (!projectId) {
          setBdChatNotice({
            level: "error",
            message: "Auto-assign unavailable: no active project is loaded."
          });
          return;
        }
        const commandId = dispatchAutoAssign(projectId);
        if (!commandId) {
          setBdChatNotice({
            level: "error",
            message: "Auto-assign unavailable: world socket is not connected."
          });
          return;
        }
        openPanel("task-board");
        setFocusedPoi("poi_task_board");
        setBdChatNotice({
          level: "success",
          message: `Submitted "${label}". Waiting for server ack.`
        });
        return;
      }
      case "clarify":
        openPanel("inbox");
        setFocusedPoi("poi_reception_inbox");
        setBdChatNotice({
          level: "success",
          message: "Opened Inbox to capture clarification."
        });
        return;
      default:
        openPanel("inbox");
        setFocusedPoi("poi_reception_inbox");
        setBdChatNotice({
          level: "success",
          message: `Suggestion "${label}" noted. Use Inbox to execute it.`
        });
    }
  };

  const renderTaskOverrideActions = (task: TaskSnapshot) => {
    const canReassign = (task.status === "planned" || task.status === "blocked") && Boolean(task.assignee);
    const fallbackAssignee = agents.find(
      (agent) => agent.id !== (task.assignee ?? "") && agent.id.trim().length > 0
    )?.id;
    const canCancel = task.status !== "done" && task.status !== "cancelled";
    const canRerun = task.status === "done" || task.status === "cancelled";

    return (
      <div className="task-override-actions">
        <button
          type="button"
          disabled={!canReassign || !fallbackAssignee}
          onClick={() => {
            if (!fallbackAssignee) {
              return;
            }
            const commandId = dispatchReassignTask({
              taskId: task.id,
              toAgentId: fallbackAssignee,
              fromAgentId: task.assignee,
              expectedTaskStatus: task.status,
              reason: "Client override from Task Board"
            });
            if (commandId) {
              setTaskBoardNotice({
                level: "success",
                message: `Reassign override submitted for ${task.id} -> ${fallbackAssignee}.`
              });
            }
          }}
        >
          Reassign
        </button>
        <button
          type="button"
          disabled={!canCancel}
          onClick={() => {
            if (
              pendingCancelTask?.taskId === task.id &&
              pendingCancelTask.expectedVersion === cancelConfirmationVersion(task)
            ) {
              const commandId = dispatchCancelTask({
                taskId: task.id,
                expectedTaskStatus: task.status,
                reason: "Client override from Task Board"
              });
              if (commandId) {
                setTaskBoardNotice({
                  level: "success",
                  message: `Cancel override submitted for ${task.id}.`
                });
              }
              setPendingCancelTask(null);
              return;
            }
            setPendingCancelTask({
              taskId: task.id,
              expectedVersion: cancelConfirmationVersion(task)
            });
            setTaskBoardNotice({
              level: "error",
              message: `Press Cancel again to confirm cancellation for ${task.id}.`
            });
          }}
        >
          {pendingCancelTask?.taskId === task.id &&
          pendingCancelTask.expectedVersion === cancelConfirmationVersion(task)
            ? "Confirm Cancel"
            : "Cancel"}
        </button>
        <button
          type="button"
          disabled={!canRerun}
          onClick={() => {
            const commandId = dispatchRerunTask({
              sourceTaskId: task.id,
              reason: "Client override rerun request"
            });
            if (commandId) {
              setTaskBoardNotice({
                level: "success",
                message: `Rerun override submitted for ${task.id}.`
              });
            }
          }}
        >
          Rerun
        </button>
      </div>
    );
  };

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable
      );
    }

    function onGlobalKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        setFocusedPoi(null);
        setFocusedAgent(null);
        return;
      }

      if (event.altKey && !event.metaKey && !event.ctrlKey) {
        const shortcutPanel = PANEL_SHORTCUTS[event.key];
        if (shortcutPanel) {
          event.preventDefault();
          openPanel(shortcutPanel);
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          setFocusedPoi(null);
          setFocusedAgent(null);
        }
      }
    }

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [openPanel, setFocusedAgent, setFocusedPoi]);

  useEffect(() => {
    if (!focusedArtifact) {
      setChangeInstructions("");
      setSplitTaskTitlesInput("");
      return;
    }
    setChangeInstructions("");
    setSplitTaskTitlesInput("");
  }, [focusedArtifact?.artifactId]);

  useEffect(() => {
    if (!focusedDecision) {
      setDecisionChoice("");
      return;
    }
    setDecisionChoice(focusedDecision.choice ?? "");
  }, [focusedDecision?.choice, focusedDecision?.decisionId]);

  useEffect(() => {
    if (!pendingCancelTask) {
      return;
    }
    const task = taskLookup[pendingCancelTask.taskId];
    if (!task || cancelConfirmationVersion(task) !== pendingCancelTask.expectedVersion) {
      setPendingCancelTask(null);
    }
  }, [pendingCancelTask, taskLookup]);

  useEffect(() => {
    if (!firstRunHelpVisible || !guidedOnboardingActive) {
      return;
    }
    const container = firstRunHelpRef.current;
    if (!container) {
      return;
    }
    const firstFocusable = container.querySelector<HTMLElement>("button, textarea, input, [href]");
    firstFocusable?.focus();
  }, [firstRunHelpVisible, guidedOnboardingActive, guidedOnboardingStepIndex]);

  return (
    <div className={`overlay-root${reducedMotionEnabled ? " reduced-motion" : ""}`}>
      {hoveredAffordance ? (
        <div className="poi-affordance-tooltip" role="status" aria-live="polite">
          <p className="poi-affordance-title">{hoveredAffordance.label}</p>
          <p className="poi-affordance-copy">{hoveredAffordance.tooltip}</p>
        </div>
      ) : null}
      {focusedAffordanceLabel ? (
        <div className="poi-focus-marker" role="status" aria-live="polite">
          Focused: {focusedAffordanceLabel}
        </div>
      ) : null}
      <aside className="panel-list">
        <h1>OfficeClaw v0</h1>
        <p>Client scaffold with render loop + state boundaries.</p>
        {firstRunHelpVisible ? (
          <section
            ref={firstRunHelpRef}
            className="first-run-help"
            onKeyDown={(event) => trapOnboardingFocus(event)}
          >
            <h2>{guidedOnboardingActive ? onboardingStep.title : "Quick Start"}</h2>
            <p>
              {guidedOnboardingActive
                ? onboardingStep.primary
                : "Goal for your first run: submit a request, watch tasks populate, inspect agents, and resolve blockers."}
            </p>
            <p>
              {guidedOnboardingActive
                ? onboardingStep.secondary
                : "Click floor to move. Click POIs to open Inbox, Task Board, or Delivery Shelf. Use Event Feed for traceability."}
            </p>
            {guidedOnboardingActive ? (
              <p>
                Step {guidedOnboardingStepIndex + 1}/{ONBOARDING_FLOW_STEPS.length}
              </p>
            ) : (
              <ol className="first-run-help-steps">
                <li>Submit a request from Inbox to create kickoff and tasks.</li>
                <li>Use Task Board to assign and monitor work state.</li>
                <li>Review artifacts and resolve decisions to unblock flow.</li>
              </ol>
            )}
            <p className="onboarding-metrics">
              Onboarding metrics: visits {onboardingVisitSummary}
              {guidedOnboardingMetrics.dropOffStepId
                ? ` · last drop-off=${guidedOnboardingMetrics.dropOffStepId}`
                : ""}
              {guidedOnboardingMetrics.completedAtMs
                ? ` · completed=${eventTimeLabel(guidedOnboardingMetrics.completedAtMs)}`
                : ""}
            </p>
            <div className="first-run-help-actions">
              {!guidedOnboardingActive ? (
                <button type="button" onClick={beginGuidedOnboarding}>
                  Start Guided Flow
                </button>
              ) : null}
              {guidedOnboardingActive ? (
                <button
                  type="button"
                  onClick={() => activateOnboardingStep(guidedOnboardingStepIndex - 1)}
                  disabled={guidedOnboardingStepIndex === 0}
                >
                  Back
                </button>
              ) : null}
              {guidedOnboardingActive ? (
                <button
                  type="button"
                  onClick={() => {
                    if (guidedOnboardingStepIndex >= ONBOARDING_FLOW_STEPS.length - 1) {
                      finishGuidedFlow();
                      return;
                    }
                    activateOnboardingStep(guidedOnboardingStepIndex + 1);
                  }}
                >
                  {guidedOnboardingStepIndex >= ONBOARDING_FLOW_STEPS.length - 1 ? "Finish" : "Next"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  replayGuidedOnboarding(ONBOARDING_FLOW_STEPS[0].id);
                  activateOnboardingStep(0, { updateMetric: false });
                }}
              >
                Replay
              </button>
              <button type="button" onClick={skipGuidedFlow}>
                {guidedOnboardingActive ? "Skip" : "Dismiss"}
              </button>
            </div>
          </section>
        ) : null}
        <p>Connection: {world.connectionStatus}</p>
        <p>{connectionHint(world.connectionStatus)}</p>
        <p>Reconnect attempts: {world.reconnectAttempt}</p>
        {world.lastConnectionError ? <p>Last error: {world.lastConnectionError}</p> : null}
        <p>Resume cursor seq: {world.lastSeq ?? "none"}</p>
        <p>Last snapshot id: {world.lastSnapshotId ?? "none"}</p>
        <p>
          Startup assets: {processedAssets}/{world.assetStartup.total} loaded={world.assetStartup.loaded}
          {" "}failed={world.assetStartup.failed}
        </p>
        {world.assetStartup.inProgress ? <p>Asset startup is still in progress.</p> : null}
        {hasCriticalAssetFailure ? (
          <p className="status-error">
            Critical asset failed. Verify required files such as `/assets/office_shell.glb` and refresh.
          </p>
        ) : null}
        {!hasCriticalAssetFailure && world.assetStartup.failed > 0 ? (
          <p className="status-warning">
            Non-critical asset failures detected. Placeholder geometry is active.
          </p>
        ) : null}
        {world.assetStartup.lastError ? <p>Asset error: {world.assetStartup.lastError}</p> : null}
        <section className="scene-runtime-summary">
          <h2>Scene Runtime</h2>
          <p className={runtimeStatusClass(sceneRuntime.snapshot.status)}>
            <strong>
              Status: {sceneRuntime.snapshot.status}
              {" "}
              ({sceneRuntime.snapshot.progress.phase} {sceneRuntime.snapshot.progress.percent}%)
            </strong>
          </p>
          <p>{sceneRuntime.snapshot.progress.label}</p>
          <p>
            Load policy:
            {" "}
            {`shell -> critical (${sceneLoadPolicy.criticalLoaded}/${sceneLoadPolicy.criticalTotal}) -> decor (${sceneLoadPolicy.decorLoaded}/${sceneLoadPolicy.decorTotal})`}
          </p>
          {sceneRuntimeNotice ? (
            <p className={sceneRuntimeNotice.startsWith("Reload failed") ? "status-error" : "status-ok"}>
              {sceneRuntimeNotice}
            </p>
          ) : null}
          {visibleSceneRuntimeIssues.length > 0 ? (
            <ul className="scene-runtime-issues">
              {visibleSceneRuntimeIssues.map((issue) => (
                <li
                  key={issue.id}
                  className={`scene-runtime-issue scene-runtime-issue-${issue.severity}`}
                >
                  <p>
                    <strong>{issue.code}</strong>
                    {" "}
                    ({issue.source})
                  </p>
                  <p>{issue.message}</p>
                  <p className="scene-runtime-issue-action">{runtimeIssueActionHint(issue)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-ok">No provider issues detected.</p>
          )}
          <div className="scene-runtime-actions">
            <button
              type="button"
              onClick={() => {
                void reloadSceneRuntime();
              }}
              disabled={sceneRuntimeReloadPending}
            >
              {sceneRuntimeReloadPending ? "Reloading Scene..." : "Reload Scene Runtime"}
            </button>
          </div>
        </section>
        <p>Agents in store: {Object.keys(world.agents).length}</p>
        <p>Hovered: {interaction.hoveredId ?? "none"}</p>
        <p>Focused POI: {focusedPoiId ?? "none"}</p>
        <p>Focused agent: {focusedAgentId ?? "none"}</p>
        <p>
          Player: [{player.position[0].toFixed(2)}, {player.position[1].toFixed(2)}, {player.position[2].toFixed(2)}]
        </p>
        <p>Player path nodes: {player.activePath.length}</p>
        <p>
          Local nav: {player.navDebug.lastStatus}
          {player.navDebug.lastReason ? ` (${player.navDebug.lastReason})` : ""}
        </p>
        <p>
          Nav grid: {player.navDebug.gridWidth}x{player.navDebug.gridHeight} cells, cell={player.navDebug.cellSize}
          , blocked={player.navDebug.blockedCellCount}, occupied={player.navDebug.occupiedCellCount}
        </p>
        {debugHudProfileEnabled ? (
          <section className="debug-hud">
            <h2>Debug HUD</h2>
            <label className="debug-toggle">
              <input
                type="checkbox"
                checked={debugHudEnabled}
                onChange={(event) => setDebugHudEnabled(event.target.checked)}
              />
              <span>Enable dev HUD</span>
            </label>
            {debugHudEnabled ? (
              <>
                <p>FPS: {fmt(world.runtimePerf.fps, 1)}</p>
                <p>Frame avg: {fmt(world.runtimePerf.frameAvgMs, 2)} ms</p>
                <p>Frame p95: {fmt(world.runtimePerf.frameP95Ms, 2)} ms</p>
                <p>
                  Frame hotspots (&gt;20ms): {world.runtimePerf.frameHotspotCount}/
                  {world.runtimePerf.frameSampleCount} ({fmt(world.runtimePerf.hotspotPercent, 1)}%)
                </p>
                <p>Draw calls: {fmt(world.runtimePerf.drawCalls, 0)}</p>
                <p>Triangles: {fmt(world.runtimePerf.triangles, 0)}</p>
                <p>
                  Render primitives: lines={fmt(world.runtimePerf.lines, 0)} points=
                  {fmt(world.runtimePerf.points, 0)}
                </p>
                <p>
                  Perf alert level: {world.runtimePerf.alertLevel}
                  {world.runtimePerf.alerts.length > 0
                    ? ` (${world.runtimePerf.alerts.join(", ")})`
                    : ""}
                </p>
                <p>
                  Asset startup duration: {fmt(world.assetStartup.durationMs, 0)} ms
                  {world.assetStartup.slowestAssetId
                    ? ` (slowest: ${world.assetStartup.slowestAssetId} ${fmt(world.assetStartup.slowestAssetMs, 0)} ms)`
                    : ""}
                </p>
                <p>
                  Scene runtime: {sceneRuntime.snapshot.status}
                  {" "}({sceneRuntime.snapshot.progress.phase} {sceneRuntime.snapshot.progress.percent}%)
                </p>
                <p>Scene runtime issues: {sceneRuntimeIssues.length}</p>
                {sceneRuntimeIssues.length > 0 ? (
                  <p className={runtimeStatusClass(sceneRuntime.snapshot.status)}>
                    Latest provider issue: {sceneRuntimeIssues[0]?.code} —{" "}
                    {sceneRuntimeIssues[0]?.message}
                  </p>
                ) : null}
                <div className="debug-toggle-group">
                  <label className="debug-toggle">
                    <input
                      type="checkbox"
                      checked={showPathOverlay}
                      onChange={(event) => setShowPathOverlay(event.target.checked)}
                    />
                    <span>Path nodes overlay</span>
                  </label>
                  <label className="debug-toggle">
                    <input
                      type="checkbox"
                      checked={showBlockedCellsOverlay}
                      onChange={(event) => setShowBlockedCellsOverlay(event.target.checked)}
                    />
                    <span>Blocked cells overlay</span>
                  </label>
                  <label className="debug-toggle">
                    <input
                      type="checkbox"
                      checked={showAnchorIssueOverlay}
                      onChange={(event) => setShowAnchorIssueOverlay(event.target.checked)}
                    />
                    <span>Anchor issue overlay</span>
                  </label>
                </div>
                <p>
                  Authoring capture: press <code>C</code> over a POI to capture anchor patch JSON.
                  Press <code>Shift+C</code> over a POI/object to capture collider/object transform patch JSON.
                </p>
                <p>
                  Last capture: {player.navDebug.lastCaptureTarget ?? "none"}
                  {player.navDebug.lastCaptureMode ? ` (${player.navDebug.lastCaptureMode})` : ""}
                </p>
                {player.navDebug.lastCapturePoint ? (
                  <p>
                    Capture point: [{player.navDebug.lastCapturePoint[0].toFixed(3)},
                    {" "}
                    {player.navDebug.lastCapturePoint[1].toFixed(3)},
                    {" "}
                    {player.navDebug.lastCapturePoint[2].toFixed(3)}]
                  </p>
                ) : null}
                {player.navDebug.lastCaptureSnippet ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "11px", lineHeight: 1.35 }}>
                    {player.navDebug.lastCaptureSnippet}
                  </pre>
                ) : null}
                <section className="scene-editor">
                  <h3>Scene Editor (Placement)</h3>
                  <label className="debug-toggle">
                    <input
                      type="checkbox"
                      checked={sceneEditorEnabled}
                      onChange={(event) => setSceneEditorEnabled(event.target.checked)}
                    />
                    <span>Enable placement editor</span>
                  </label>
                  <p>Selected candidate: {sceneEditorCandidateObject?.id ?? "none"}</p>
                  <p>Active object: {sceneEditorActiveObject?.id ?? "none"}</p>
                  <div className="scene-editor-actions">
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled || !sceneEditorCandidateObject}
                      onClick={() => selectSceneEditorObject(sceneEditorCandidateObject)}
                    >
                      Edit Selected Object
                    </button>
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled || !sceneEditorActiveObject}
                      onClick={resetSceneEditorActiveToManifest}
                    >
                      Reset to Manifest
                    </button>
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled || !sceneEditorActiveObject || !sceneEditorActiveDraft}
                      onClick={placeSceneEditorObjectAtPointerXZ}
                    >
                      Place at Pointer X/Z
                    </button>
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled || !sceneEditorActiveObject || !sceneEditorActiveDraft}
                      onClick={() => {
                        if (!sceneEditorActiveObject || !sceneEditorActiveDraft) {
                          return;
                        }
                        replaceSceneEditorDraft(sceneEditorActiveObject.id, {
                          ...sceneEditorActiveDraft,
                          pos: [sceneEditorActiveDraft.pos[0], 0, sceneEditorActiveDraft.pos[2]]
                        });
                        setSceneEditorNotice(`Snapped ${sceneEditorActiveObject.id} to floor (Y=0).`);
                      }}
                    >
                      Snap Y=0
                    </button>
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled || !sceneEditorActiveObject || !sceneEditorActiveDraft}
                      onClick={() => {
                        if (!sceneEditorActiveObject) {
                          return;
                        }
                        void copySceneEditorPatch();
                      }}
                    >
                      Copy Transform Patch
                    </button>
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled || !sceneEditorActiveObject}
                      onClick={() => {
                        if (!sceneEditorActiveObject) {
                          return;
                        }
                        clearSceneEditorDraft(sceneEditorActiveObject.id);
                        setSceneEditorNotice(`Cleared draft for ${sceneEditorActiveObject.id}.`);
                      }}
                    >
                      Clear Active Draft
                    </button>
                    <button
                      type="button"
                      disabled={!sceneEditorEnabled}
                      onClick={() => {
                        clearAllSceneEditorDrafts();
                        setSceneEditorNotice("Cleared all scene editor drafts.");
                      }}
                    >
                      Clear All Drafts
                    </button>
                  </div>
                  <div className="scene-editor-grid">
                    <p>Move step: 0.05m</p>
                    <div className="scene-editor-axis-row">
                      <span>X</span>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("pos", 0, -0.05)}
                      >
                        -0.05
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("pos", 0, 0.05)}
                      >
                        +0.05
                      </button>
                    </div>
                    <div className="scene-editor-axis-row">
                      <span>Y</span>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("pos", 1, -0.05)}
                      >
                        -0.05
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("pos", 1, 0.05)}
                      >
                        +0.05
                      </button>
                    </div>
                    <div className="scene-editor-axis-row">
                      <span>Z</span>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("pos", 2, -0.05)}
                      >
                        -0.05
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("pos", 2, 0.05)}
                      >
                        +0.05
                      </button>
                    </div>
                    <p>Rotate step: 0.05 rad</p>
                    <div className="scene-editor-axis-row">
                      <span>Yaw</span>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("rot", 1, -0.05)}
                      >
                        -0.05
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("rot", 1, 0.05)}
                      >
                        +0.05
                      </button>
                    </div>
                    <p>Scale step: 0.05</p>
                    <div className="scene-editor-axis-row">
                      <span>Scale</span>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("scale", 0, -0.05)}
                      >
                        X-
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("scale", 0, 0.05)}
                      >
                        X+
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("scale", 1, -0.05)}
                      >
                        Y-
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("scale", 1, 0.05)}
                      >
                        Y+
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("scale", 2, -0.05)}
                      >
                        Z-
                      </button>
                      <button
                        type="button"
                        disabled={!sceneEditorEnabled || !sceneEditorActiveDraft}
                        onClick={() => nudgeSceneEditorActive("scale", 2, 0.05)}
                      >
                        Z+
                      </button>
                    </div>
                  </div>
                  {sceneEditorActiveDraft ? (
                    <>
                      <p>pos: {formatTransformTuple(sceneEditorActiveDraft.pos)}</p>
                      <p>rot: {formatTransformTuple(sceneEditorActiveDraft.rot)}</p>
                      <p>scale: {formatTransformTuple(sceneEditorActiveDraft.scale)}</p>
                      <pre className="scene-editor-patch-preview">
{JSON.stringify(
  {
    id: sceneEditorActiveObject?.id,
    transform: {
      pos: sceneEditorActiveDraft.pos.map(roundTransformValue),
      rot: sceneEditorActiveDraft.rot.map(roundTransformValue),
      scale: sceneEditorActiveDraft.scale.map(roundTransformValue)
    }
  },
  null,
  2
)}
                      </pre>
                    </>
                  ) : null}
                  {sceneEditorNotice ? <p className="status-ok">{sceneEditorNotice}</p> : null}
                </section>
              </>
            ) : null}
          </section>
        ) : null}
        <div className="panel-actions">
          {(Object.keys(panelLabels) as PanelId[]).map((panelId) => {
            const open = openPanels.includes(panelId);
            return (
              <button
                key={panelId}
                type="button"
                onClick={() => (open ? closePanel(panelId) : openPanel(panelId))}
              >
                {open ? "Hide" : "Show"} {panelLabels[panelId]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setFocusedPoi(null);
              setFocusedAgent(null);
            }}
          >
            Clear Focus (Esc)
          </button>
          <button
            type="button"
            onClick={reopenFirstRunHelp}
            disabled={firstRunHelpVisible}
          >
            Show Help
          </button>
        </div>
        <section className="a11y-controls">
          <h2>Accessibility</h2>
          <label className="debug-toggle">
            <input
              type="checkbox"
              checked={reducedMotionEnabled}
              onChange={(event) => setReducedMotionEnabled(event.target.checked)}
            />
            <span>Reduced motion mode</span>
          </label>
          <p>Keyboard shortcuts: Alt+1..7 open panels, Alt+0 clears focus, Esc clears scene focus.</p>
        </section>
      </aside>
      <section className="panel-stack">
        {openPanels.map((panelId) => {
          const isAnchored =
            Boolean(anchoredPanelId) &&
            panelId === anchoredPanelId &&
            Boolean(focusedPoiScreenAnchor);

          const isEventFeed = panelId === "event-feed";
          const isInbox = panelId === "inbox";
          const isBdChat = panelId === "bd-chat";
          const isTaskBoard = panelId === "task-board";
          const isArtifactViewer = panelId === "artifact-viewer";
          const isDecisionPanel = panelId === "decision-panel";
          const isAgentInspector = panelId === "agent-inspector";

          return (
            <article
              key={panelId}
              className={`panel-card${isAnchored ? " panel-card-anchored" : ""}`}
              style={
                isAnchored && focusedPoiScreenAnchor
                  ? {
                      left: `${focusedPoiScreenAnchor.x}px`,
                      top: `${focusedPoiScreenAnchor.y}px`
                    }
                  : undefined
              }
            >
              <h2>{panelLabels[panelId]}</h2>
              {isEventFeed ? (
                hasConnectionIssue && prioritizedEvents.length === 0 ? (
                  <PanelStateMessage
                    kind="error"
                    primary="Couldn't load event timeline."
                    secondary="Reason: event stream is disconnected. Next: wait for reconnect, then refresh this panel."
                    actionLabel="Open Inbox"
                    onAction={() => openPanel("inbox")}
                  />
                ) : isConnectionLoading && prioritizedEvents.length === 0 ? (
                  <PanelStateMessage
                    kind="loading"
                    primary="Event timeline is loading."
                    secondary="Recent office activity will appear here."
                  />
                ) : prioritizedEvents.length === 0 ? (
                  <PanelStateMessage
                    kind="empty"
                    primary="No events yet."
                    secondary="Submit a request to generate kickoff and task events."
                    actionLabel="Go to Inbox"
                    onAction={() => openPanel("inbox")}
                  />
                ) : (
                  <div className="event-feed-list">
                    {prioritizedEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="event-feed-item"
                        onClick={() => {
                          const nextPoiId = resolveEventFocusPoi(event);
                          const nextAgentId = resolveEventFocusAgent(event, taskLookup);

                          if (nextPoiId) {
                            setFocusedPoi(nextPoiId);
                            const linkedPanel = PANEL_BY_POI[nextPoiId];
                            if (linkedPanel) {
                              openPanel(linkedPanel);
                            }
                          } else {
                            setFocusedPoi(null);
                          }

                          if (nextAgentId) {
                            setFocusedAgent(nextAgentId);
                            openPanel("agent-inspector");
                          } else if (!nextPoiId) {
                            setFocusedAgent(null);
                          }

                          if (event.decisionId) {
                            setFocusedDecision(event.decisionId);
                            openPanel("decision-panel");
                          }
                          if (event.artifactId) {
                            setFocusedArtifact(event.artifactId);
                            openPanel("artifact-viewer");
                          }
                        }}
                      >
                        <span className="event-feed-item-title">{eventTitle(event.name)}</span>
                        <span className="event-feed-item-time">{eventTimeLabel(event.ts)}</span>
                        <span className="event-feed-item-subtitle">{eventSubtitle(event)}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : isInbox ? (
                <div className="inbox-panel">
                  {hasConnectionIssue ? (
                    <PanelStateMessage
                      kind="error"
                      primary="Couldn't load inbox requests."
                      secondary="Reason: connection to world server failed. Next: wait for reconnect, then retry your request."
                      actionLabel="Open Event Feed"
                      onAction={() => openPanel("event-feed")}
                    />
                  ) : isConnectionLoading ? (
                    <PanelStateMessage
                      kind="loading"
                      primary="Inbox is loading."
                      secondary="Recent requests and kickoff status will appear here."
                    />
                  ) : null}
                  <label htmlFor="submit-request-input">Request</label>
                  <textarea
                    id="submit-request-input"
                    className="inbox-textarea"
                    placeholder="Describe what you want OfficeClaw to do..."
                    value={requestText}
                    onChange={(event) => {
                      setRequestText(event.target.value);
                      if (inboxNotice) {
                        setInboxNotice(null);
                      }
                    }}
                  />
                  <div className="inbox-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const commandId = dispatchSubmitRequest(requestText);
                        if (commandId) {
                          setRequestText("");
                        }
                      }}
                    >
                      Submit Request
                    </button>
                  </div>
                  {inboxNotice ? (
                    <p className={inboxNotice.level === "error" ? "status-error" : "status-ok"}>
                      {inboxNotice.message}
                    </p>
                  ) : null}
                </div>
              ) : isBdChat ? (
                <div className="bd-chat-panel">
                  {bdChatNotice ? (
                    <p className={bdChatNotice.level === "error" ? "status-error" : "status-ok"}>
                      {bdChatNotice.message}
                    </p>
                  ) : null}
                  {hasConnectionIssue && bdMainMessages.length === 0 ? (
                    <PanelStateMessage
                      kind="error"
                      primary="Couldn't load BD chat."
                      secondary="Reason: chat stream is unavailable. Next: wait for reconnect, then reopen this panel."
                      actionLabel="Open Inbox"
                      onAction={() => openPanel("inbox")}
                    />
                  ) : isConnectionLoading && bdMainMessages.length === 0 ? (
                    <PanelStateMessage
                      kind="loading"
                      primary="BD chat is loading."
                      secondary="Advisories and suggested actions will appear here."
                    />
                  ) : bdMainMessages.length === 0 ? (
                    <PanelStateMessage
                      kind="empty"
                      primary="No BD messages yet."
                      secondary="This panel only surfaces `bd_main` chat involving Business Director."
                      actionLabel="Open Inbox"
                      onAction={() => openPanel("inbox")}
                    />
                  ) : (
                    <div className="bd-chat-list">
                      {bdMainMessages.map((message) => (
                        <article key={message.messageId} className="bd-chat-item">
                          <p className="bd-chat-meta">
                            {message.from} → {message.to} • {eventTimeLabel(message.ts)}
                          </p>
                          <p>{message.text}</p>
                          {message.suggestedActions.length > 0 ? (
                            <div className="bd-chat-actions">
                              {message.suggestedActions.map((suggested) => (
                                <button
                                  key={`${message.messageId}:${suggested.action}:${suggested.label}`}
                                  type="button"
                                  onClick={() => runBdSuggestedAction(suggested.action, suggested.label)}
                                >
                                  {suggested.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : isTaskBoard ? (
                <div className="task-board-panel">
                  {taskBoardNotice ? (
                    <p className={taskBoardNotice.level === "error" ? "status-error" : "status-ok"}>
                      {taskBoardNotice.message}
                    </p>
                  ) : null}
                  {hasConnectionIssue && tasks.length === 0 ? (
                    <PanelStateMessage
                      kind="error"
                      primary="Couldn't load task board."
                      secondary="Reason: connection to world server failed. Next: wait for reconnect, then refresh board."
                      actionLabel="Open Event Feed"
                      onAction={() => openPanel("event-feed")}
                    />
                  ) : isConnectionLoading && tasks.length === 0 ? (
                    <PanelStateMessage
                      kind="loading"
                      primary="Task board is loading."
                      secondary="Current assignments and progress are syncing."
                    />
                  ) : null}
                  <div className="task-board-actions">
                    <button
                      type="button"
                      disabled={hasConnectionIssue || isConnectionLoading || !activeProjectId}
                      onClick={() => {
                        if (!activeProjectId) {
                          setTaskBoardNotice({
                            level: "error",
                            message: "No project in current snapshot for auto-assign."
                          });
                          return;
                        }
                        const commandId = dispatchAutoAssign(activeProjectId);
                        if (!commandId) {
                          return;
                        }
                        setTaskBoardNotice({
                          level: "success",
                          message: "Auto-assign requested. Waiting for server response."
                        });
                      }}
                    >
                      Trigger Auto-Assign
                    </button>
                    <button
                      type="button"
                      disabled={hasConnectionIssue || isConnectionLoading || !activeProjectId}
                      onClick={() => {
                        if (!activeProjectId) {
                          return;
                        }
                        const commandId = dispatchPauseProject({
                          projectId: activeProjectId,
                          reason: "Client override from Task Board"
                        });
                        if (commandId) {
                          setTaskBoardNotice({
                            level: "success",
                            message: `Pause override submitted for ${activeProjectId}.`
                          });
                        }
                      }}
                    >
                      Pause Dispatch
                    </button>
                    <button
                      type="button"
                      disabled={hasConnectionIssue || isConnectionLoading || !activeProjectId}
                      onClick={() => {
                        if (!activeProjectId) {
                          return;
                        }
                        const commandId = dispatchResumeProject({
                          projectId: activeProjectId,
                          reason: "Client override from Task Board"
                        });
                        if (commandId) {
                          setTaskBoardNotice({
                            level: "success",
                            message: `Resume override submitted for ${activeProjectId}.`
                          });
                        }
                      }}
                    >
                      Resume Dispatch
                    </button>
                  </div>
                  <p>
                    Task Board tip: drag a task card onto a specialist column, or use Trigger Auto-Assign for
                    automatic routing.
                  </p>
                  {taskDragGhost ? (
                    <p className="task-drag-ghost">
                      Moving `{taskDragGhost.taskId}` from `{taskDragGhost.fromAssignee ?? "unassigned"}`
                      {" "}to `{taskDragGhost.toAssignee ?? "?"}`
                    </p>
                  ) : null}
                  {tasks.length === 0 ? (
                    <PanelStateMessage
                      kind="empty"
                      primary="No tasks yet."
                      secondary="Requests create tasks automatically after kickoff."
                      actionLabel="Go to Inbox"
                      onAction={() => openPanel("inbox")}
                    />
                  ) : (
                    <>
                      <div className="task-status-columns">
                        <div className="task-column">
                          <h3>To Do</h3>
                          {tasks
                            .filter((task) => task.status === "planned")
                            .map((task) => (
                              <div
                                key={task.id}
                                className="task-card"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData("text/task-id", task.id);
                                  event.dataTransfer.effectAllowed = "move";
                                  setTaskDragGhost({
                                    taskId: task.id,
                                    fromAssignee: task.assignee ?? null,
                                    toAssignee: task.assignee ?? null
                                  });
                                }}
                                onDragEnd={() => setTaskDragGhost(null)}
                              >
                                <strong>{task.title}</strong>
                                <span>{task.id}</span>
                                <span>Assignee: {task.assignee ?? "unassigned"}</span>
                                <span className="task-why">
                                  {taskWhyHint(task.id, task.status, task.assignee, events)}
                                </span>
                                <button
                                  type="button"
                                  className="trace-link"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    traceTaskToTimeline(task.id);
                                  }}
                                >
                                  Trace in timeline
                                </button>
                                {renderTaskOverrideActions(task)}
                              </div>
                            ))}
                        </div>
                        <div className="task-column">
                          <h3>Doing</h3>
                          {tasks
                            .filter((task) => task.status === "in_progress" || task.status === "blocked")
                            .map((task) => (
                              <div
                                key={task.id}
                                className="task-card"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData("text/task-id", task.id);
                                  event.dataTransfer.effectAllowed = "move";
                                  setTaskDragGhost({
                                    taskId: task.id,
                                    fromAssignee: task.assignee ?? null,
                                    toAssignee: task.assignee ?? null
                                  });
                                }}
                                onDragEnd={() => setTaskDragGhost(null)}
                              >
                                <strong>{task.title}</strong>
                                <span>{task.id}</span>
                                <span>Assignee: {task.assignee ?? "unassigned"}</span>
                                <span className="task-why">
                                  {taskWhyHint(task.id, task.status, task.assignee, events)}
                                </span>
                                <button
                                  type="button"
                                  className="trace-link"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    traceTaskToTimeline(task.id);
                                  }}
                                >
                                  Trace in timeline
                                </button>
                                {renderTaskOverrideActions(task)}
                              </div>
                            ))}
                        </div>
                        <div className="task-column">
                          <h3>Done</h3>
                          {tasks
                            .filter((task) => task.status === "done")
                            .map((task) => (
                              <div
                                key={task.id}
                                className="task-card"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData("text/task-id", task.id);
                                  event.dataTransfer.effectAllowed = "move";
                                  setTaskDragGhost({
                                    taskId: task.id,
                                    fromAssignee: task.assignee ?? null,
                                    toAssignee: task.assignee ?? null
                                  });
                                }}
                                onDragEnd={() => setTaskDragGhost(null)}
                              >
                                <strong>{task.title}</strong>
                                <span>{task.id}</span>
                                <span>Assignee: {task.assignee ?? "unassigned"}</span>
                                <span className="task-why">
                                  {taskWhyHint(task.id, task.status, task.assignee, events)}
                                </span>
                                <button
                                  type="button"
                                  className="trace-link"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    traceTaskToTimeline(task.id);
                                  }}
                                >
                                  Trace in timeline
                                </button>
                                {renderTaskOverrideActions(task)}
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="task-assignment-columns">
                        {agents.map((agent) => (
                          <div
                            key={agent.id}
                            className={`task-column${taskDragGhost?.toAssignee === agent.id ? " task-column-drop" : ""}`}
                            onDragOver={(event) => {
                              event.preventDefault();
                              if (taskDragGhost) {
                                setTaskDragGhost({
                                  ...taskDragGhost,
                                  toAssignee: agent.id
                                });
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const taskId =
                                taskDragGhost?.taskId ?? event.dataTransfer.getData("text/task-id");
                              if (!taskId) {
                                return;
                              }

                              const commandId = dispatchAssignTask(taskId, agent.id);
                              if (commandId) {
                                useWorldStore
                                  .getState()
                                  .applyOptimisticTaskAssignment(taskId, agent.id, commandId);
                                setTaskBoardNotice({
                                  level: "success",
                                  message: `Optimistically assigning ${taskId} to ${agent.id}...`
                                });
                              }
                              setTaskDragGhost(null);
                            }}
                          >
                            <h3>{agent.id}</h3>
                            {tasks
                              .filter((task) => task.assignee === agent.id)
                              .map((task) => (
                                <div key={task.id} className="task-card">
                                  <strong>{task.title}</strong>
                                  <span>{task.id}</span>
                                  <span>Status: {task.status}</span>
                                  <span className="task-why">
                                    {taskWhyHint(task.id, task.status, task.assignee, events)}
                                  </span>
                                  <button
                                    type="button"
                                    className="trace-link"
                                    onClick={() => traceTaskToTimeline(task.id)}
                                  >
                                    Trace in timeline
                                  </button>
                                  {renderTaskOverrideActions(task)}
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : isArtifactViewer ? (
                <div className="artifact-viewer-panel">
                  {artifactNotice ? (
                    <p className={artifactNotice.level === "error" ? "status-error" : "status-ok"}>
                      {artifactNotice.message}
                    </p>
                  ) : null}
                  <div className="artifact-columns">
                    <div className="artifact-list">
                      <h3>Artifacts ({sortedArtifacts.length})</h3>
                      <p>
                        {reviewableArtifacts.length} review-active • {historicalArtifacts.length} historical
                      </p>
                      {hasConnectionIssue && sortedArtifacts.length === 0 ? (
                        <PanelStateMessage
                          kind="error"
                          primary="Couldn't open deliverables."
                          secondary="Reason: artifact stream is unavailable. Next: wait for reconnect, then reload artifacts."
                          actionLabel="Open Event Feed"
                          onAction={() => openPanel("event-feed")}
                        />
                      ) : isConnectionLoading && sortedArtifacts.length === 0 ? (
                        <PanelStateMessage
                          kind="loading"
                          primary="Deliverable is loading."
                          secondary="Version details and review actions are on the way."
                        />
                      ) : sortedArtifacts.length === 0 ? (
                        <PanelStateMessage
                          kind="empty"
                          primary="No deliverables yet."
                          secondary="Artifacts appear here when tasks reach delivery."
                          actionLabel="Check Active Tasks"
                          onAction={() => openPanel("task-board")}
                        />
                      ) : (
                        sortedArtifacts.map((artifact) => (
                          <button
                            key={artifact.artifactId}
                            type="button"
                            className={`artifact-list-item${
                              focusedArtifact?.artifactId === artifact.artifactId
                                ? " artifact-list-item-active"
                                : ""
                            }`}
                            onClick={() => {
                              setFocusedArtifact(artifact.artifactId);
                              setArtifactNotice(null);
                            }}
                          >
                            <span>{artifact.artifactId}</span>
                            <span>v{artifact.version} • {titleFromToken(artifact.status)}</span>
                            <span>{artifact.type} • {artifact.taskId ?? "task: n/a"}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="artifact-card">
                      {!focusedArtifact ? (
                        <PanelStateMessage
                          kind="empty"
                          primary="No artifact selected."
                          secondary="Pick an artifact from the list to inspect version details and review actions."
                        />
                      ) : (
                        <>
                          <p><strong>ID:</strong> {focusedArtifact.artifactId}</p>
                          <p><strong>Status:</strong> {titleFromToken(focusedArtifact.status)}</p>
                          <p><strong>Version:</strong> {focusedArtifact.version}</p>
                          <p><strong>Project:</strong> {focusedArtifact.projectId}</p>
                          <p><strong>Task:</strong> {focusedArtifact.taskId ?? "n/a"}</p>
                          <p><strong>POI:</strong> {focusedArtifact.poiId ?? "n/a"}</p>
                          <p><strong>Type:</strong> {titleFromToken(focusedArtifact.type)}</p>
                          <p>
                            <strong>Provenance:</strong>{" "}
                            {focusedArtifactTask
                              ? `from ${focusedArtifactTask.id} assigned to ${
                                  focusedArtifactTask.assignee ?? "unassigned"
                                }`
                              : "source task unavailable"}
                          </p>
                          <p>
                            <strong>Timeline Trace:</strong>{" "}
                            {focusedArtifactTraceEvent
                              ? `${eventTitle(focusedArtifactTraceEvent.name)} @ ${eventTimeLabel(
                                  focusedArtifactTraceEvent.ts
                                )}`
                              : "no related event yet"}
                          </p>
                          <button
                            type="button"
                            className="trace-link"
                            onClick={() =>
                              traceArtifactToTimeline(
                                focusedArtifact.artifactId,
                                focusedArtifact.taskId
                              )
                            }
                          >
                            Trace in timeline
                          </button>
                          {!artifactActionsEnabled ? (
                            <p className="status-warning">
                              Review actions are disabled for status `{focusedArtifact.status}`.
                            </p>
                          ) : null}
                          <label htmlFor="artifact-change-instructions"><strong>Change Instructions</strong></label>
                          <textarea
                            id="artifact-change-instructions"
                            className="inbox-textarea"
                            value={changeInstructions}
                            onChange={(event) => {
                              setChangeInstructions(event.target.value);
                              if (artifactNotice) {
                                setArtifactNotice(null);
                              }
                            }}
                            placeholder="Describe requested revisions..."
                            disabled={!artifactActionsEnabled}
                          />
                          <label htmlFor="artifact-split-task-titles"><strong>Split Into Tasks</strong></label>
                          <textarea
                            id="artifact-split-task-titles"
                            className="inbox-textarea"
                            value={splitTaskTitlesInput}
                            onChange={(event) => {
                              setSplitTaskTitlesInput(event.target.value);
                              if (artifactNotice) {
                                setArtifactNotice(null);
                              }
                            }}
                            placeholder={"One task title per line\nDraft 3 headline variants\nCreate 2 CTA options"}
                            disabled={!artifactActionsEnabled}
                          />
                          <div className="artifact-actions">
                            <button
                              type="button"
                              disabled={!artifactActionsEnabled}
                              onClick={() => {
                                const commandId = dispatchApproveArtifact(focusedArtifact.artifactId);
                                if (commandId) {
                                  setArtifactNotice({
                                    level: "success",
                                    message: "Approve request submitted. Awaiting ack."
                                  });
                                }
                              }}
                            >
                              Approve Artifact
                            </button>
                            <button
                              type="button"
                              disabled={!artifactActionsEnabled}
                              onClick={() => {
                                const commandId = dispatchRequestArtifactChanges(
                                  focusedArtifact.artifactId,
                                  changeInstructions
                                );
                                if (commandId) {
                                  setArtifactNotice({
                                    level: "success",
                                    message: "Change request submitted. Awaiting ack."
                                  });
                                }
                              }}
                            >
                              Request Changes
                            </button>
                            <button
                              type="button"
                              disabled={!artifactActionsEnabled}
                              onClick={() => {
                                const commandId = dispatchSplitArtifactIntoTasks(
                                  focusedArtifact.artifactId,
                                  splitTaskTitlesInput.split("\n")
                                );
                                if (commandId) {
                                  setArtifactNotice({
                                    level: "success",
                                    message: "Split request submitted. Awaiting ack."
                                  });
                                }
                              }}
                            >
                              Split Into Tasks
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : isDecisionPanel ? (
                <div className="decision-panel">
                  {decisionNotice ? (
                    <p className={decisionNotice.level === "error" ? "status-error" : "status-ok"}>
                      {decisionNotice.message}
                    </p>
                  ) : null}
                  {hasConnectionIssue && decisions.length === 0 ? (
                    <PanelStateMessage
                      kind="error"
                      primary="Couldn't load decisions."
                      secondary="Reason: latest decision snapshot is unavailable. Next: wait for reconnect, then refresh panel."
                      actionLabel="Open Task Board"
                      onAction={() => openPanel("task-board")}
                    />
                  ) : isConnectionLoading && decisions.length === 0 ? (
                    <PanelStateMessage
                      kind="loading"
                      primary="Decision prompt is loading."
                      secondary="Required context and options will appear here."
                    />
                  ) : null}
                  <div className="decision-columns">
                    <div className="decision-list">
                      <h3>Open ({openDecisions.length})</h3>
                      {openDecisions.length === 0 ? (
                        <PanelStateMessage
                          kind="empty"
                          primary="No open decisions right now."
                          secondary="Blocked tasks will surface here when input is required."
                          actionLabel="View Active Tasks"
                          onAction={() => openPanel("task-board")}
                        />
                      ) : (
                        openDecisions.map((decision) => (
                          <button
                            key={decision.decisionId}
                            type="button"
                            className={`decision-list-item${
                              focusedDecision?.decisionId === decision.decisionId ? " decision-list-item-active" : ""
                            }`}
                            onClick={() => {
                              setFocusedDecision(decision.decisionId);
                              setDecisionNotice(null);
                            }}
                          >
                            <span>{decision.decisionId}</span>
                            <span>{decision.taskId ?? "task: n/a"}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="decision-card">
                      {!focusedDecision ? (
                        <PanelStateMessage
                          kind="empty"
                          primary="No decision selected."
                          secondary="Pick an open decision from the list to inspect and resolve it."
                        />
                      ) : (
                        <>
                          <p><strong>ID:</strong> {focusedDecision.decisionId}</p>
                          <p><strong>Status:</strong> {titleFromToken(focusedDecision.status)}</p>
                          <p><strong>Project:</strong> {focusedDecision.projectId}</p>
                          <p><strong>Task:</strong> {focusedDecision.taskId ?? "n/a"}</p>
                          <p><strong>Prompt:</strong> {focusedDecision.prompt}</p>
                          <label htmlFor="decision-choice-input"><strong>Choice</strong></label>
                          <textarea
                            id="decision-choice-input"
                            className="inbox-textarea"
                            value={decisionChoice}
                            onChange={(event) => setDecisionChoice(event.target.value)}
                            placeholder="Provide decision outcome..."
                            disabled={focusedDecision.status !== "open"}
                          />
                          <div className="decision-actions">
                            <button
                              type="button"
                              disabled={focusedDecision.status !== "open"}
                              onClick={() => setDecisionChoice("approved")}
                            >
                              Quick: Approve
                            </button>
                            <button
                              type="button"
                              disabled={focusedDecision.status !== "open"}
                              onClick={() => setDecisionChoice("needs_changes")}
                            >
                              Quick: Needs Changes
                            </button>
                            <button
                              type="button"
                              disabled={focusedDecision.status !== "open"}
                              onClick={() => {
                                const commandId = dispatchResolveDecision(
                                  focusedDecision.decisionId,
                                  decisionChoice
                                );
                                if (commandId) {
                                  setDecisionNotice({
                                    level: "success",
                                    message: "Decision resolve submitted. Awaiting ack."
                                  });
                                }
                              }}
                            >
                              Resolve Decision
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : isAgentInspector ? (
                <div className="agent-inspector-panel">
                  {!inspectorAgent ? (
                    hasConnectionIssue ? (
                      <PanelStateMessage
                        kind="error"
                        primary="Couldn't load agent state."
                        secondary="Reason: latest snapshot is unavailable. Next: wait for reconnect, then retry."
                        actionLabel="Open Event Feed"
                        onAction={() => openPanel("event-feed")}
                      />
                    ) : isConnectionLoading ? (
                      <PanelStateMessage
                        kind="loading"
                        primary="Agent details are loading."
                        secondary="State, current task, and blockers will appear here."
                      />
                    ) : (
                      <PanelStateMessage
                        kind="empty"
                        primary="No active agent selected."
                        secondary="Click an agent in the scene or assign work from the task board."
                        actionLabel="Open Task Board"
                        onAction={() => openPanel("task-board")}
                      />
                    )
                  ) : (
                    <>
                      <p><strong>Agent:</strong> {inspectorAgent.id}</p>
                      <p><strong>Role:</strong> {roleLabel(inspectorAgent.id)}</p>
                      <p><strong>State:</strong> {titleFromToken(inspectorAgent.state)}</p>
                      <p>
                        <strong>Position:</strong> [{inspectorAgent.pos[0].toFixed(2)},{" "}
                        {inspectorAgent.pos[1].toFixed(2)}, {inspectorAgent.pos[2].toFixed(2)}]
                      </p>
                      <p>
                        <strong>Task:</strong>{" "}
                        {inspectorTask
                          ? `${inspectorTask.id} (${titleFromToken(inspectorTask.status)})`
                          : "none"}
                      </p>
                      <p>
                        <strong>Blocker:</strong>{" "}
                        {inspectorTask?.status === "blocked" || inspectorAgent.state === "blocked"
                          ? inspectorDecisionId ?? "blocked (no decision id)"
                          : "none"}
                      </p>
                      <p>
                        <strong>Needs:</strong>{" "}
                        {inspectorNeeds.length > 0 ? inspectorNeeds.join(" • ") : "none"}
                      </p>
                      <p>
                        <strong>Why this state:</strong>{" "}
                        {inspectorTraceEvent
                          ? `${eventTitle(inspectorTraceEvent.name)} @ ${eventTimeLabel(
                              inspectorTraceEvent.ts
                            )}`
                          : "no recent lifecycle event"}
                      </p>
                      <div className="agent-inspector-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedAgent(inspectorAgent.id);
                          }}
                        >
                          Focus Agent
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openPanel("task-board");
                            if (inspectorTask) {
                              setFocusedAgent(inspectorAgent.id);
                            }
                          }}
                        >
                          Open Task Board
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openPanel("event-feed");
                            setFocusedAgent(inspectorAgent.id);
                          }}
                        >
                          Open Event Feed
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openPanel("inbox");
                            setFocusedPoi("poi_reception_inbox");
                          }}
                        >
                          Open Decision/Chat Inbox
                        </button>
                      </div>
                      {inspectorTask ? (
                        <div className="agent-inspector-overrides">
                          <p><strong>Override Controls</strong></p>
                          <div className="task-override-actions">
                            <button
                              type="button"
                              onClick={() => {
                                const commandId = dispatchPauseProject({
                                  projectId: inspectorTask.projectId,
                                  reason: "Client override from Agent Inspector"
                                });
                                if (commandId) {
                                  setTaskBoardNotice({
                                    level: "success",
                                    message: `Pause override submitted for ${inspectorTask.projectId}.`
                                  });
                                }
                              }}
                            >
                              Pause Dispatch
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const commandId = dispatchResumeProject({
                                  projectId: inspectorTask.projectId,
                                  reason: "Client override from Agent Inspector"
                                });
                                if (commandId) {
                                  setTaskBoardNotice({
                                    level: "success",
                                    message: `Resume override submitted for ${inspectorTask.projectId}.`
                                  });
                                }
                              }}
                            >
                              Resume Dispatch
                            </button>
                            <button
                              type="button"
                              disabled={
                                !(inspectorTask.status === "planned" || inspectorTask.status === "blocked")
                              }
                              onClick={() => {
                                const alternateAgentId = agents.find(
                                  (agent) => agent.id !== (inspectorTask.assignee ?? "")
                                )?.id;
                                if (!alternateAgentId) {
                                  setTaskBoardNotice({
                                    level: "error",
                                    message: "No alternate agent available for reassign override."
                                  });
                                  return;
                                }
                                const commandId = dispatchReassignTask({
                                  taskId: inspectorTask.id,
                                  toAgentId: alternateAgentId,
                                  fromAgentId: inspectorTask.assignee,
                                  expectedTaskStatus: inspectorTask.status,
                                  reason: "Client override from Agent Inspector"
                                });
                                if (commandId) {
                                  setTaskBoardNotice({
                                    level: "success",
                                    message: `Reassign override submitted for ${inspectorTask.id} -> ${alternateAgentId}.`
                                  });
                                }
                              }}
                            >
                              Reassign
                            </button>
                            <button
                              type="button"
                              disabled={inspectorTask.status === "done" || inspectorTask.status === "cancelled"}
                              onClick={() => {
                                if (
                                  pendingCancelTask?.taskId === inspectorTask.id &&
                                  pendingCancelTask.expectedVersion ===
                                    cancelConfirmationVersion(inspectorTask)
                                ) {
                                  const commandId = dispatchCancelTask({
                                    taskId: inspectorTask.id,
                                    expectedTaskStatus: inspectorTask.status,
                                    reason: "Client override from Agent Inspector"
                                  });
                                  if (commandId) {
                                    setTaskBoardNotice({
                                      level: "success",
                                      message: `Cancel override submitted for ${inspectorTask.id}.`
                                    });
                                  }
                                  setPendingCancelTask(null);
                                  return;
                                }
                                setPendingCancelTask({
                                  taskId: inspectorTask.id,
                                  expectedVersion: cancelConfirmationVersion(inspectorTask)
                                });
                                setTaskBoardNotice({
                                  level: "error",
                                  message: `Press Cancel again to confirm cancellation for ${inspectorTask.id}.`
                                });
                              }}
                            >
                              {pendingCancelTask?.taskId === inspectorTask.id &&
                              pendingCancelTask.expectedVersion ===
                                cancelConfirmationVersion(inspectorTask)
                                ? "Confirm Cancel"
                                : "Cancel"}
                            </button>
                            <button
                              type="button"
                              disabled={
                                inspectorTask.status !== "done" && inspectorTask.status !== "cancelled"
                              }
                              onClick={() => {
                                const commandId = dispatchRerunTask({
                                  sourceTaskId: inspectorTask.id,
                                  reason: "Client override rerun request from Agent Inspector"
                                });
                                if (commandId) {
                                  setTaskBoardNotice({
                                    level: "success",
                                    message: `Rerun override submitted for ${inspectorTask.id}.`
                                  });
                                }
                              }}
                            >
                              Rerun
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                <p>Placeholder panel shell for v0 integration.</p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
