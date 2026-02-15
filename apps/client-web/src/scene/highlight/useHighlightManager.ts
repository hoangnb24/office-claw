import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { useInteractionStore } from "../../state/interactionStore";
import { useUiStore } from "../../state/uiStore";
import { HighlightManager } from "./HighlightManager";
import { poiHighlightNodesById } from "./poiHighlightManifest";

export function useHighlightManager() {
  const { scene } = useThree();

  const hoveredId = useInteractionStore((state) => state.hoveredId);
  const hoveredType = useInteractionStore((state) => state.hoveredType);
  const selectedId = useInteractionStore((state) => state.selectedId);
  const selectedType = useInteractionStore((state) => state.selectedType);

  const focusedPoiId = useUiStore((state) => state.focusedPoiId);
  const focusedAgentId = useUiStore((state) => state.focusedAgentId);

  const highlightManager = useMemo(
    () => new HighlightManager(poiHighlightNodesById),
    []
  );

  const activePoiId =
    focusedPoiId ??
    (selectedType === "poi" ? selectedId : null) ??
    (hoveredType === "poi" ? hoveredId : null);

  const participantAgentIds = useMemo(() => {
    const ids = new Set<string>();

    if (focusedAgentId) {
      ids.add(focusedAgentId);
    }
    if (selectedType === "agent" && selectedId) {
      ids.add(selectedId);
    }
    if (hoveredType === "agent" && hoveredId) {
      ids.add(hoveredId);
    }

    return [...ids].sort();
  }, [focusedAgentId, hoveredId, hoveredType, selectedId, selectedType]);

  const participantKey = participantAgentIds.join(",");

  useEffect(() => {
    highlightManager.applyFocus(scene, {
      poiId: activePoiId,
      participantAgentIds
    });

    return () => {
      highlightManager.clear();
    };
  }, [activePoiId, highlightManager, participantAgentIds, participantKey, scene]);

  return {
    highlightedPoiId: activePoiId,
    participantAgentIds
  };
}
