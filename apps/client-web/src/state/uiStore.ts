import { create } from "zustand";

export type PanelId =
  | "event-feed"
  | "inbox"
  | "bd-chat"
  | "task-board"
  | "agent-inspector"
  | "artifact-viewer"
  | "decision-panel";
export type PanelNoticeLevel = "success" | "error";
export type TaskBoardNoticeLevel = PanelNoticeLevel;
export type DecisionStatus = "open" | "resolved";
export type ArtifactStatus =
  | "created"
  | "delivered"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "superseded"
  | "archived";

export interface TaskBoardNotice {
  level: PanelNoticeLevel;
  message: string;
}

export interface InboxNotice {
  level: PanelNoticeLevel;
  message: string;
}

export interface DecisionNotice {
  level: PanelNoticeLevel;
  message: string;
}

export interface ArtifactNotice {
  level: PanelNoticeLevel;
  message: string;
}

export interface BdChatNotice {
  level: PanelNoticeLevel;
  message: string;
}

export interface BdChatSuggestedAction {
  action: string;
  label: string;
}

export interface BdChatMessage {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  text: string;
  suggestedActions: BdChatSuggestedAction[];
  ts: number;
}

export interface DecisionSnapshot {
  decisionId: string;
  projectId: string;
  taskId?: string;
  prompt: string;
  status: DecisionStatus;
  choice?: string;
  updatedTs: number;
}

export interface ArtifactSnapshot {
  artifactId: string;
  projectId: string;
  type: string;
  status: ArtifactStatus;
  version: number;
  taskId?: string;
  poiId?: string;
  updatedTs: number;
}

export interface TaskDragGhost {
  taskId: string;
  fromAssignee: string | null;
  toAssignee: string | null;
}

export interface ScreenAnchor {
  x: number;
  y: number;
}

export type OnboardingStepId = "inbox" | "task_board" | "artifact_viewer" | "decision_panel";

export const GUIDED_ONBOARDING_STEPS: OnboardingStepId[] = [
  "inbox",
  "task_board",
  "artifact_viewer",
  "decision_panel"
];

export interface OnboardingMetrics {
  startedAtMs: number | null;
  completedAtMs: number | null;
  skippedAtMs: number | null;
  dropOffStepId: OnboardingStepId | null;
  stepVisits: Record<OnboardingStepId, number>;
}

const FIRST_RUN_HELP_STORAGE_KEY = "officeclaw:first-run-help-dismissed";
const REDUCED_MOTION_STORAGE_KEY = "officeclaw:reduced-motion";
const ARTIFACT_REVIEW_PRIORITY: Record<ArtifactStatus, number> = {
  in_review: 0,
  delivered: 1,
  changes_requested: 2,
  created: 3,
  approved: 4,
  superseded: 5,
  archived: 6
};

function compareArtifacts(a: ArtifactSnapshot, b: ArtifactSnapshot): number {
  const byPriority = ARTIFACT_REVIEW_PRIORITY[a.status] - ARTIFACT_REVIEW_PRIORITY[b.status];
  if (byPriority !== 0) {
    return byPriority;
  }
  const byVersion = b.version - a.version;
  if (byVersion !== 0) {
    return byVersion;
  }
  return b.updatedTs - a.updatedTs;
}

function pickFocusedArtifactId(artifacts: Record<string, ArtifactSnapshot>): string | null {
  const list = Object.values(artifacts);
  if (list.length === 0) {
    return null;
  }
  list.sort(compareArtifacts);
  return list[0]?.artifactId ?? null;
}

function readFirstRunHelpVisible(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.localStorage.getItem(FIRST_RUN_HELP_STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function createEmptyOnboardingMetrics(): OnboardingMetrics {
  return {
    startedAtMs: null,
    completedAtMs: null,
    skippedAtMs: null,
    dropOffStepId: null,
    stepVisits: {
      inbox: 0,
      task_board: 0,
      artifact_viewer: 0,
      decision_panel: 0
    }
  };
}

function readReducedMotionPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const stored = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (stored === "1") {
      return true;
    }
    if (stored === "0") {
      return false;
    }
  } catch {
    // Ignore storage failures and fall back to system preference.
  }
  if (typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface UiStore {
  openPanels: PanelId[];
  firstRunHelpVisible: boolean;
  guidedOnboardingActive: boolean;
  guidedOnboardingStepIndex: number;
  guidedOnboardingMetrics: OnboardingMetrics;
  focusedPoiId: string | null;
  focusedAgentId: string | null;
  focusedPoiScreenAnchor: ScreenAnchor | null;
  reducedMotionEnabled: boolean;
  debugHudEnabled: boolean;
  showPathOverlay: boolean;
  showBlockedCellsOverlay: boolean;
  showAnchorIssueOverlay: boolean;
  artifacts: Record<string, ArtifactSnapshot>;
  focusedArtifactId: string | null;
  artifactNotice: ArtifactNotice | null;
  decisions: Record<string, DecisionSnapshot>;
  focusedDecisionId: string | null;
  decisionNotice: DecisionNotice | null;
  taskBoardNotice: TaskBoardNotice | null;
  inboxNotice: InboxNotice | null;
  bdChatMessages: BdChatMessage[];
  bdChatNotice: BdChatNotice | null;
  taskDragGhost: TaskDragGhost | null;
  openPanel: (panelId: PanelId) => void;
  closePanel: (panelId: PanelId) => void;
  dismissFirstRunHelp: () => void;
  reopenFirstRunHelp: () => void;
  startGuidedOnboarding: (stepId: OnboardingStepId) => void;
  setGuidedOnboardingStep: (index: number, stepId: OnboardingStepId) => void;
  completeGuidedOnboarding: () => void;
  skipGuidedOnboarding: (stepId: OnboardingStepId) => void;
  replayGuidedOnboarding: (stepId: OnboardingStepId) => void;
  setFocusedPoi: (poiId: string | null) => void;
  setFocusedAgent: (agentId: string | null) => void;
  setFocusedPoiScreenAnchor: (anchor: ScreenAnchor | null) => void;
  setReducedMotionEnabled: (enabled: boolean) => void;
  setDebugHudEnabled: (enabled: boolean) => void;
  setShowPathOverlay: (enabled: boolean) => void;
  setShowBlockedCellsOverlay: (enabled: boolean) => void;
  setShowAnchorIssueOverlay: (enabled: boolean) => void;
  setArtifacts: (artifacts: ArtifactSnapshot[]) => void;
  upsertArtifact: (artifact: ArtifactSnapshot) => void;
  setFocusedArtifact: (artifactId: string | null) => void;
  setArtifactNotice: (notice: ArtifactNotice | null) => void;
  markArtifactStatus: (artifactId: string, status: ArtifactStatus, updatedTs?: number) => void;
  setDecisions: (decisions: DecisionSnapshot[]) => void;
  upsertDecision: (decision: DecisionSnapshot) => void;
  setFocusedDecision: (decisionId: string | null) => void;
  setDecisionNotice: (notice: DecisionNotice | null) => void;
  markDecisionResolved: (decisionId: string, choice?: string) => void;
  setTaskBoardNotice: (notice: TaskBoardNotice | null) => void;
  setInboxNotice: (notice: InboxNotice | null) => void;
  appendBdChatMessage: (message: BdChatMessage) => void;
  setBdChatNotice: (notice: BdChatNotice | null) => void;
  setTaskDragGhost: (ghost: TaskDragGhost | null) => void;
}

const debugProfileEnabled =
  import.meta.env.DEV ||
  import.meta.env.VITE_DEBUG_HUD === "1" ||
  import.meta.env.VITE_NAV_DEBUG === "1";

export const useUiStore = create<UiStore>((set) => ({
  openPanels: ["event-feed"],
  firstRunHelpVisible: readFirstRunHelpVisible(),
  guidedOnboardingActive: false,
  guidedOnboardingStepIndex: 0,
  guidedOnboardingMetrics: createEmptyOnboardingMetrics(),
  focusedPoiId: null,
  focusedAgentId: null,
  focusedPoiScreenAnchor: null,
  reducedMotionEnabled: readReducedMotionPreference(),
  debugHudEnabled: debugProfileEnabled,
  showPathOverlay: debugProfileEnabled,
  showBlockedCellsOverlay: debugProfileEnabled,
  showAnchorIssueOverlay: debugProfileEnabled,
  artifacts: {},
  focusedArtifactId: null,
  artifactNotice: null,
  decisions: {},
  focusedDecisionId: null,
  decisionNotice: null,
  taskBoardNotice: null,
  inboxNotice: null,
  bdChatMessages: [],
  bdChatNotice: null,
  taskDragGhost: null,
  openPanel: (panelId) =>
    set((state) => ({
      openPanels: state.openPanels.includes(panelId) ? state.openPanels : [...state.openPanels, panelId]
    })),
  closePanel: (panelId) =>
    set((state) => ({
      openPanels: state.openPanels.filter((panel) => panel !== panelId)
    })),
  dismissFirstRunHelp: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(FIRST_RUN_HELP_STORAGE_KEY, "1");
      } catch {
        // Ignore storage failures; UI state still updates for current session.
      }
    }
    set({ firstRunHelpVisible: false });
  },
  reopenFirstRunHelp: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(FIRST_RUN_HELP_STORAGE_KEY);
      } catch {
        // Ignore storage failures; UI state still updates for current session.
      }
    }
    set({ firstRunHelpVisible: true });
  },
  startGuidedOnboarding: (stepId) =>
    set((state) => ({
      firstRunHelpVisible: true,
      guidedOnboardingActive: true,
      guidedOnboardingStepIndex: 0,
      guidedOnboardingMetrics: {
        ...state.guidedOnboardingMetrics,
        startedAtMs: state.guidedOnboardingMetrics.startedAtMs ?? Date.now(),
        dropOffStepId: null,
        stepVisits: {
          ...state.guidedOnboardingMetrics.stepVisits,
          [stepId]: (state.guidedOnboardingMetrics.stepVisits[stepId] ?? 0) + 1
        }
      }
    })),
  setGuidedOnboardingStep: (index, stepId) =>
    set((state) => ({
      guidedOnboardingStepIndex: Math.max(0, Math.min(GUIDED_ONBOARDING_STEPS.length - 1, index)),
      guidedOnboardingMetrics: {
        ...state.guidedOnboardingMetrics,
        stepVisits: {
          ...state.guidedOnboardingMetrics.stepVisits,
          [stepId]: (state.guidedOnboardingMetrics.stepVisits[stepId] ?? 0) + 1
        }
      }
    })),
  completeGuidedOnboarding: () =>
    {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(FIRST_RUN_HELP_STORAGE_KEY, "1");
        } catch {
          // Ignore storage failures; in-memory state still updates.
        }
      }
      set((state) => ({
        guidedOnboardingActive: false,
        firstRunHelpVisible: false,
        guidedOnboardingMetrics: {
          ...state.guidedOnboardingMetrics,
          completedAtMs: Date.now(),
          dropOffStepId: null
        }
      }));
    },
  skipGuidedOnboarding: (stepId) =>
    {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(FIRST_RUN_HELP_STORAGE_KEY, "1");
        } catch {
          // Ignore storage failures; in-memory state still updates.
        }
      }
      set((state) => ({
        guidedOnboardingActive: false,
        firstRunHelpVisible: false,
        guidedOnboardingMetrics: {
          ...state.guidedOnboardingMetrics,
          skippedAtMs: Date.now(),
          dropOffStepId: stepId
        }
      }));
    },
  replayGuidedOnboarding: (stepId) =>
    {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(FIRST_RUN_HELP_STORAGE_KEY);
        } catch {
          // Ignore storage failures; in-memory state still updates.
        }
      }
      set(() => ({
        firstRunHelpVisible: true,
        guidedOnboardingActive: true,
        guidedOnboardingStepIndex: 0,
        guidedOnboardingMetrics: {
          ...createEmptyOnboardingMetrics(),
          startedAtMs: Date.now(),
          stepVisits: {
            ...createEmptyOnboardingMetrics().stepVisits,
            [stepId]: 1
          }
        }
      }));
    },
  setFocusedPoi: (poiId) => set({ focusedPoiId: poiId }),
  setFocusedAgent: (agentId) => set({ focusedAgentId: agentId }),
  setFocusedPoiScreenAnchor: (focusedPoiScreenAnchor) => set({ focusedPoiScreenAnchor }),
  setReducedMotionEnabled: (reducedMotionEnabled) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, reducedMotionEnabled ? "1" : "0");
      } catch {
        // Ignore storage failures; in-memory state still updates.
      }
    }
    set({ reducedMotionEnabled });
  },
  setDebugHudEnabled: (debugHudEnabled) => set({ debugHudEnabled }),
  setShowPathOverlay: (showPathOverlay) => set({ showPathOverlay }),
  setShowBlockedCellsOverlay: (showBlockedCellsOverlay) => set({ showBlockedCellsOverlay }),
  setShowAnchorIssueOverlay: (showAnchorIssueOverlay) => set({ showAnchorIssueOverlay }),
  setArtifacts: (artifacts) =>
    set((state) => {
      const next = Object.fromEntries(artifacts.map((artifact) => [artifact.artifactId, artifact]));
      const focusedArtifactId =
        state.focusedArtifactId && next[state.focusedArtifactId]
          ? state.focusedArtifactId
          : pickFocusedArtifactId(next);
      return {
        artifacts: next,
        focusedArtifactId
      };
    }),
  upsertArtifact: (artifact) =>
    set((state) => ({
      artifacts: {
        ...state.artifacts,
        [artifact.artifactId]: artifact
      },
      focusedArtifactId: state.focusedArtifactId ?? artifact.artifactId
    })),
  setFocusedArtifact: (focusedArtifactId) => set({ focusedArtifactId }),
  setArtifactNotice: (artifactNotice) => set({ artifactNotice }),
  markArtifactStatus: (artifactId, status, updatedTs) =>
    set((state) => {
      const artifact = state.artifacts[artifactId];
      if (!artifact) {
        return state;
      }
      return {
        artifacts: {
          ...state.artifacts,
          [artifactId]: {
            ...artifact,
            status,
            updatedTs: updatedTs ?? Date.now()
          }
        }
      };
    }),
  setDecisions: (decisions) =>
    set((state) => {
      const next = Object.fromEntries(
        decisions.map((decision) => [decision.decisionId, decision])
      );
      const focusedDecisionId =
        state.focusedDecisionId && next[state.focusedDecisionId]
          ? state.focusedDecisionId
          : Object.values(next).find((decision) => decision.status === "open")?.decisionId ?? null;
      return {
        decisions: next,
        focusedDecisionId
      };
    }),
  upsertDecision: (decision) =>
    set((state) => ({
      decisions: {
        ...state.decisions,
        [decision.decisionId]: decision
      },
      focusedDecisionId:
        state.focusedDecisionId ??
        (decision.status === "open" ? decision.decisionId : null)
    })),
  setFocusedDecision: (focusedDecisionId) => set({ focusedDecisionId }),
  setDecisionNotice: (decisionNotice) => set({ decisionNotice }),
  markDecisionResolved: (decisionId, choice) =>
    set((state) => {
      const decision = state.decisions[decisionId];
      if (!decision) {
        return state;
      }
      return {
        decisions: {
          ...state.decisions,
          [decisionId]: {
            ...decision,
            status: "resolved",
            choice: choice ?? decision.choice,
            updatedTs: Date.now()
          }
        }
      };
    }),
  setTaskBoardNotice: (taskBoardNotice) => set({ taskBoardNotice }),
  setInboxNotice: (inboxNotice) => set({ inboxNotice }),
  appendBdChatMessage: (message) =>
    set((state) => {
      const deduped = state.bdChatMessages.filter((entry) => entry.messageId !== message.messageId);
      const next = [...deduped, message].sort((a, b) => a.ts - b.ts);
      return {
        bdChatMessages: next.slice(-60)
      };
    }),
  setBdChatNotice: (bdChatNotice) => set({ bdChatNotice }),
  setTaskDragGhost: (taskDragGhost) => set({ taskDragGhost })
}));
