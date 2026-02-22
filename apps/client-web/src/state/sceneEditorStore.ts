import { create } from "zustand";

export type EditorVec3 = [number, number, number];

export interface SceneEditorTransformDraft {
  pos: EditorVec3;
  rot: EditorVec3;
  scale: EditorVec3;
}

interface SceneEditorStore {
  enabled: boolean;
  activeObjectId: string | null;
  draftsByObjectId: Record<string, SceneEditorTransformDraft>;
  setEnabled: (enabled: boolean) => void;
  setActiveObjectId: (objectId: string | null) => void;
  ensureDraft: (objectId: string, draft: SceneEditorTransformDraft) => void;
  replaceDraft: (objectId: string, draft: SceneEditorTransformDraft) => void;
  nudgeActive: (channel: "pos" | "rot" | "scale", axis: 0 | 1 | 2, delta: number) => void;
  clearDraft: (objectId: string) => void;
  clearAllDrafts: () => void;
}

function cloneDraft(draft: SceneEditorTransformDraft): SceneEditorTransformDraft {
  return {
    pos: [...draft.pos] as EditorVec3,
    rot: [...draft.rot] as EditorVec3,
    scale: [...draft.scale] as EditorVec3
  };
}

export function normalizeEditorDraft(input: {
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}): SceneEditorTransformDraft {
  return {
    pos: [...input.pos] as EditorVec3,
    rot: [...(input.rot ?? [0, 0, 0])] as EditorVec3,
    scale: [...(input.scale ?? [1, 1, 1])] as EditorVec3
  };
}

export const useSceneEditorStore = create<SceneEditorStore>((set) => ({
  enabled: false,
  activeObjectId: null,
  draftsByObjectId: {},
  setEnabled: (enabled) => set({ enabled }),
  setActiveObjectId: (activeObjectId) => set({ activeObjectId }),
  ensureDraft: (objectId, draft) =>
    set((state) => {
      if (state.draftsByObjectId[objectId]) {
        return state;
      }
      return {
        draftsByObjectId: {
          ...state.draftsByObjectId,
          [objectId]: cloneDraft(draft)
        }
      };
    }),
  replaceDraft: (objectId, draft) =>
    set((state) => ({
      draftsByObjectId: {
        ...state.draftsByObjectId,
        [objectId]: cloneDraft(draft)
      }
    })),
  nudgeActive: (channel, axis, delta) =>
    set((state) => {
      const activeObjectId = state.activeObjectId;
      if (!activeObjectId) {
        return state;
      }
      const current = state.draftsByObjectId[activeObjectId];
      if (!current) {
        return state;
      }
      const next = cloneDraft(current);
      next[channel][axis] += delta;
      if (channel === "scale") {
        next.scale[axis] = Math.max(0.01, next.scale[axis]);
      }
      return {
        draftsByObjectId: {
          ...state.draftsByObjectId,
          [activeObjectId]: next
        }
      };
    }),
  clearDraft: (objectId) =>
    set((state) => {
      if (!(objectId in state.draftsByObjectId)) {
        return state;
      }
      const next = { ...state.draftsByObjectId };
      delete next[objectId];
      return {
        draftsByObjectId: next,
        activeObjectId: state.activeObjectId === objectId ? null : state.activeObjectId
      };
    }),
  clearAllDrafts: () => set({ draftsByObjectId: {}, activeObjectId: null })
}));
