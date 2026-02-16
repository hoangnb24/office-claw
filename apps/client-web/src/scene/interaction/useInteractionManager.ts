import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { useInteractionStore } from "../../state/interactionStore";
import { InteractionManager } from "./InteractionManager";
import type { InteractionTargetMeta } from "./interactionTypes";

function isPointerEvent(event: unknown): event is ThreeEvent<PointerEvent> {
  return Boolean(event && typeof event === "object" && "pointer" in (event as object));
}

function commandFromTarget(target: InteractionTargetMeta) {
  if (target.commandName) {
    return target.commandName;
  }
  switch (target.type) {
    case "poi":
      return "focus_poi";
    case "agent":
      return "open_agent_inspector";
    case "artifact":
      return "open_artifact";
    default:
      return "select_object";
  }
}

function cursorFromTarget(target: InteractionTargetMeta | null): string {
  if (!target) {
    return "default";
  }
  if (target.type === "poi" || target.type === "artifact" || target.type === "agent") {
    return "pointer";
  }
  if (target.commandName) {
    return "pointer";
  }
  return "default";
}

export function useInteractionManager() {
  const { camera, scene } = useThree();

  const setHovered = useInteractionStore((state) => state.setHovered);
  const setSelected = useInteractionStore((state) => state.setSelected);
  const setPointerWorldPos = useInteractionStore((state) => state.setPointerWorldPos);
  const queueCommandIntent = useInteractionStore((state) => state.queueCommandIntent);

  const manager = useMemo(
    () =>
      new InteractionManager({
        hoverIntervalMs: 60,
        dispatch: {
          onHoverChanged: (hit) => {
            setHovered(hit?.target.id ?? null, hit?.target.type ?? null);
            setPointerWorldPos(
              hit ? [hit.point.x, hit.point.y, hit.point.z] : null
            );
            if (typeof document !== "undefined") {
              document.body.style.cursor = cursorFromTarget(hit?.target ?? null);
            }
          },
          onTargetSelected: (hit) => {
            setSelected(hit.target.id, hit.target.type);
            setPointerWorldPos([hit.point.x, hit.point.y, hit.point.z]);
          },
          onCommandIntent: (intent) => {
            queueCommandIntent(intent);
          }
        }
      }),
    [queueCommandIntent, setHovered, setPointerWorldPos, setSelected]
  );

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "default";
      }
    };
  }, []);

  return {
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      manager.resolveHover(event.pointer, camera, scene);
    },
    onClick: (event: ThreeEvent<MouseEvent>) => {
      if (!isPointerEvent(event)) {
        return;
      }
      const hit = manager.resolveClick(event.pointer, camera, scene);
      if (hit && !hit.target.commandName) {
        queueCommandIntent({
          name: commandFromTarget(hit.target),
          sourceId: hit.target.id,
          sourceType: hit.target.type,
          payload: { point: [hit.point.x, hit.point.y, hit.point.z] }
        });
      }
    },
    onPointerOut: () => {
      manager.clearHover();
      setPointerWorldPos(null);
      if (typeof document !== "undefined") {
        document.body.style.cursor = "default";
      }
    }
  };
}
