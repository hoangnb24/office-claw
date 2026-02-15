import { create } from "zustand";

export type InteractionTargetType = "poi" | "agent" | "artifact" | "object";

export interface InteractionCommandIntent {
  name: string;
  sourceId: string;
  sourceType: InteractionTargetType;
  payload?: Record<string, unknown>;
}

interface InteractionStore {
  hoveredId: string | null;
  hoveredType: InteractionTargetType | null;
  selectedId: string | null;
  selectedType: InteractionTargetType | null;
  pointerWorldPos: [number, number, number] | null;
  pendingCommandIntent: InteractionCommandIntent | null;
  setHovered: (id: string | null, type?: InteractionTargetType | null) => void;
  setSelected: (id: string | null, type?: InteractionTargetType | null) => void;
  setPointerWorldPos: (pos: [number, number, number] | null) => void;
  queueCommandIntent: (intent: InteractionCommandIntent) => void;
  clearCommandIntent: () => void;
}

export const useInteractionStore = create<InteractionStore>((set) => ({
  hoveredId: null,
  hoveredType: null,
  selectedId: null,
  selectedType: null,
  pointerWorldPos: null,
  pendingCommandIntent: null,
  setHovered: (id, type = null) => set({ hoveredId: id, hoveredType: type }),
  setSelected: (id, type = null) => set({ selectedId: id, selectedType: type }),
  setPointerWorldPos: (pointerWorldPos) => set({ pointerWorldPos }),
  queueCommandIntent: (intent) => set({ pendingCommandIntent: intent }),
  clearCommandIntent: () => set({ pendingCommandIntent: null })
}));
