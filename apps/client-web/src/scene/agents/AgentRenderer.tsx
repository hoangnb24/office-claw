import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  Object3D,
  Vector3
} from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { useWorldStore } from "../../state/worldStore";
import type { AgentGoal, AgentGoalKind, AgentState } from "../../state/worldStore";

const REQUIRED_CLIPS = ["Idle", "Walk", "Work_Typing", "Think"] as const;
type RequiredClip = (typeof REQUIRED_CLIPS)[number];
type AgentClip = RequiredClip | "Carry";
const CLIP_ALIASES: Record<AgentClip, readonly string[]> = {
  Idle: ["Idle_3", "Standing"],
  Walk: ["Walking", "Running"],
  Work_Typing: ["Sitting_Answering_Questions", "Sitting"],
  Think: ["Sitting_Clap", "Standing", "No", "Yes"],
  Carry: ["Carry_Heavy_Object_Walk"]
};
const SNAP_EASE_PER_SECOND = 8;
const SNAP_TELEPORT_THRESHOLD = 1.5;
const SNAP_EASE_DEBUG_THRESHOLD = 0.35;
const SNAP_DEBUG_EVENT_INTERVAL_MS = 600;
const MIN_SEGMENT_DISTANCE = 0.001;
type CorrectionMode = "none" | "ease" | "teleport";

interface ActiveTraversal {
  kind: AgentGoalKind;
  points: Vector3[];
  nextIndex: number;
  speedMps: number;
  arrivalRadius: number;
}

function disableShadowCasting(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Object3D & {
      isMesh?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (!mesh.isMesh) {
      return;
    }
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
}

export interface AgentRendererProps {
  agentId: string;
  state: AgentState;
  position: [number, number, number];
  goal?: AgentGoal | null;
  model?: Object3D | null;
  clips?: AnimationClip[];
  isCarrying?: boolean;
  isHighlighted?: boolean;
  onMissingClip?: (details: { agentId: string; requested: AgentClip; fallback?: string }) => void;
}

function targetClipForState(state: AgentState, isCarrying: boolean): AgentClip {
  if (isCarrying) {
    return "Carry";
  }

  switch (state) {
    case "walking":
      return "Walk";
    case "working":
      return "Work_Typing";
    case "meeting":
    case "blocked":
      return "Think";
    case "idle":
    default:
      return "Idle";
  }
}

function hasClipCoverage(actions: Map<string, AnimationAction>, clipName: RequiredClip): boolean {
  if (actions.has(clipName)) {
    return true;
  }
  return CLIP_ALIASES[clipName].some((alias) => actions.has(alias));
}

function candidateClipNames(target: AgentClip, actions: Map<string, AnimationAction>): string[] {
  const prioritized = [target, ...CLIP_ALIASES[target], "Idle", ...CLIP_ALIASES.Idle];
  if (actions.size > 0) {
    prioritized.push(...actions.keys());
  }
  return [...new Set(prioritized)];
}

function resolveAnimationState(
  baseState: AgentState,
  goalKind: AgentGoalKind | null,
  isMoving: boolean
): AgentState {
  if (isMoving) {
    return "walking";
  }
  if (goalKind === "deliver_artifact") {
    return "working";
  }
  if (goalKind === "seek_decision") {
    return "meeting";
  }
  if (goalKind === "wait") {
    return "idle";
  }
  if ((goalKind === "go_to_poi" || goalKind === "go_to_player") && baseState === "walking") {
    return "idle";
  }
  return baseState;
}

function createTraversal(goal: AgentGoal, currentPos: Vector3): ActiveTraversal | null {
  const points = goal.path.map((waypoint) => new Vector3(waypoint[0], waypoint[1], waypoint[2]));
  if (points.length === 0) {
    return null;
  }

  const firstPoint = points[0];
  const seedDistance = currentPos.distanceTo(firstPoint);
  if (seedDistance > Math.max(goal.arrivalRadius, 0.05)) {
    points.unshift(currentPos.clone());
  }

  return {
    kind: goal.kind,
    points,
    nextIndex: 0,
    speedMps: goal.speedMps,
    arrivalRadius: goal.arrivalRadius
  };
}

function advanceTraversal(currentPos: Vector3, traversal: ActiveTraversal, distanceBudget: number): boolean {
  while (distanceBudget > 0 && traversal.nextIndex < traversal.points.length) {
    const target = traversal.points[traversal.nextIndex];
    const distanceToTarget = currentPos.distanceTo(target);

    if (distanceToTarget <= Math.max(traversal.arrivalRadius, MIN_SEGMENT_DISTANCE)) {
      currentPos.copy(target);
      traversal.nextIndex += 1;
      continue;
    }

    if (distanceBudget >= distanceToTarget) {
      currentPos.copy(target);
      distanceBudget -= distanceToTarget;
      traversal.nextIndex += 1;
      continue;
    }

    currentPos.lerp(target, distanceBudget / distanceToTarget);
    distanceBudget = 0;
  }

  return traversal.nextIndex < traversal.points.length;
}

function fallbackColorByState(state: AgentState) {
  switch (state) {
    case "walking":
      return "#3ba9ff";
    case "working":
      return "#37b874";
    case "meeting":
      return "#9a7dff";
    case "blocked":
      return "#f25f5c";
    case "idle":
    default:
      return "#d9d9d9";
  }
}

export function AgentRenderer({
  agentId,
  state,
  position,
  goal,
  model,
  clips,
  isCarrying = false,
  isHighlighted = false,
  onMissingClip
}: AgentRendererProps) {
  const warnedKeysRef = useRef<Set<string>>(new Set());
  const currentActionRef = useRef<AnimationAction | null>(null);
  const groupRef = useRef<Group>(null);
  const currentPosRef = useRef(new Vector3(position[0], position[1], position[2]));
  const snapshotTargetRef = useRef(new Vector3(position[0], position[1], position[2]));
  const traversalRef = useRef<ActiveTraversal | null>(null);
  const movingRef = useRef(false);
  const correctionModeRef = useRef<CorrectionMode>("none");
  const lastCorrectionEventTsRef = useRef(0);
  const [isMoving, setIsMoving] = useState(false);

  const setMovingFlag = (next: boolean) => {
    if (movingRef.current === next) {
      return;
    }
    movingRef.current = next;
    setIsMoving(next);
  };

  const clonedModel = useMemo(() => {
    if (!model) {
      return null;
    }
    const clone = SkeletonUtils.clone(model) as Object3D;
    disableShadowCasting(clone);
    return clone;
  }, [model]);

  const mixer = useMemo(() => {
    if (!clonedModel) {
      return null;
    }

    return new AnimationMixer(clonedModel);
  }, [clonedModel]);

  const actions = useMemo(() => {
    if (!mixer || !clips || clips.length === 0) {
      return new Map<string, AnimationAction>();
    }

    const nextActions = new Map<string, AnimationAction>();
    for (const clip of clips) {
      nextActions.set(clip.name, mixer.clipAction(clip));
    }
    return nextActions;
  }, [clips, mixer]);

  const hasAllRequiredClips = useMemo(
    () => REQUIRED_CLIPS.every((clipName) => hasClipCoverage(actions, clipName)),
    [actions]
  );
  const effectiveState = resolveAnimationState(state, goal?.kind ?? null, isMoving);

  useEffect(() => {
    snapshotTargetRef.current.set(position[0], position[1], position[2]);
  }, [position]);

  useEffect(() => {
    if (!goal) {
      traversalRef.current = null;
      setMovingFlag(false);
      return;
    }

    const traversal = createTraversal(goal, currentPosRef.current);
    traversalRef.current = traversal;
    setMovingFlag(Boolean(traversal && traversal.nextIndex < traversal.points.length));
  }, [goal]);

  useEffect(() => {
    if (!mixer) {
      currentActionRef.current = null;
      return;
    }

    const target = targetClipForState(effectiveState, isCarrying);
    const candidateNames = candidateClipNames(target, actions);

    const nextName = candidateNames.find((name) => actions.has(name));
    const nextAction = nextName ? actions.get(nextName) ?? null : null;

    if (!nextAction) {
      const warnKey = `${agentId}:missing-all-clips`;
      if (!warnedKeysRef.current.has(warnKey)) {
        warnedKeysRef.current.add(warnKey);
        onMissingClip?.({ agentId, requested: target });
        console.warn(
          `[AgentRenderer] ${agentId} has no playable animation clips; rendering static model fallback`
        );
      }
      return;
    }

    if (!actions.has(target)) {
      const warnKey = `${agentId}:missing-${target}`;
      if (!warnedKeysRef.current.has(warnKey)) {
        warnedKeysRef.current.add(warnKey);
        onMissingClip?.({ agentId, requested: target, fallback: nextName });
        console.warn(
          `[AgentRenderer] ${agentId} missing clip "${target}", falling back to "${nextName}"`
        );
      }
    }

    const current = currentActionRef.current;
    if (current && current !== nextAction) {
      current.fadeOut(0.2);
    }

    nextAction.reset().fadeIn(0.2).play();
    currentActionRef.current = nextAction;

    return () => {
      currentActionRef.current?.fadeOut(0.1);
    };
  }, [actions, agentId, effectiveState, isCarrying, mixer, onMissingClip]);

  useEffect(
    () => () => {
      if (!mixer) {
        return;
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedModel as Object3D);
    },
    [clonedModel, mixer]
  );

  useFrame((_frameState, delta) => {
    const traversal = traversalRef.current;
    let moving = false;

    if (traversal) {
      moving = advanceTraversal(currentPosRef.current, traversal, traversal.speedMps * delta);
      if (!moving) {
        traversalRef.current = null;
      }
    }

    if (!moving) {
      const distanceToSnapshot = currentPosRef.current.distanceTo(snapshotTargetRef.current);
      if (distanceToSnapshot > SNAP_TELEPORT_THRESHOLD) {
        currentPosRef.current.copy(snapshotTargetRef.current);
        const nowTs = Date.now();
        if (
          correctionModeRef.current !== "teleport" ||
          nowTs - lastCorrectionEventTsRef.current >= SNAP_DEBUG_EVENT_INTERVAL_MS
        ) {
          const world = useWorldStore.getState();
          const taskId = world.agents[agentId]?.taskId;
          const projectId = taskId ? world.tasks[taskId]?.projectId ?? "proj_boot" : "proj_boot";
          world.appendEvent({
            id: `ev_snapshot_correction_${agentId}_${nowTs}`,
            ts: nowTs,
            seq: null,
            name: "snapshot_correction",
            projectId,
            taskId,
            agentId,
            participants: [agentId],
            meta: {
              mode: "hard_teleport",
              distance_m: Number(distanceToSnapshot.toFixed(3)),
              threshold_m: SNAP_TELEPORT_THRESHOLD
            }
          });
          lastCorrectionEventTsRef.current = nowTs;
        }
        correctionModeRef.current = "teleport";
      } else if (distanceToSnapshot > MIN_SEGMENT_DISTANCE) {
        currentPosRef.current.lerp(
          snapshotTargetRef.current,
          Math.min(1, delta * SNAP_EASE_PER_SECOND)
        );
        if (distanceToSnapshot >= SNAP_EASE_DEBUG_THRESHOLD) {
          const nowTs = Date.now();
          if (
            correctionModeRef.current !== "ease" ||
            nowTs - lastCorrectionEventTsRef.current >= SNAP_DEBUG_EVENT_INTERVAL_MS
          ) {
            const world = useWorldStore.getState();
            const taskId = world.agents[agentId]?.taskId;
            const projectId = taskId ? world.tasks[taskId]?.projectId ?? "proj_boot" : "proj_boot";
            world.appendEvent({
              id: `ev_snapshot_correction_${agentId}_${nowTs}`,
              ts: nowTs,
              seq: null,
              name: "snapshot_correction",
              projectId,
              taskId,
              agentId,
              participants: [agentId],
              meta: {
                mode: "ease",
                distance_m: Number(distanceToSnapshot.toFixed(3)),
                ease_per_second: SNAP_EASE_PER_SECOND
              }
            });
            lastCorrectionEventTsRef.current = nowTs;
          }
          correctionModeRef.current = "ease";
        } else {
          correctionModeRef.current = "none";
        }
      } else {
        correctionModeRef.current = "none";
      }
    } else {
      correctionModeRef.current = "none";
    }

    setMovingFlag(moving);
    groupRef.current?.position.copy(currentPosRef.current);
    mixer?.update(delta);
  });

  if (!clonedModel) {
    return (
      <group ref={groupRef}>
        <mesh position={[0, 0.8, 0]}>
          <capsuleGeometry args={[0.22, 0.55, 8, 16]} />
          <meshStandardMaterial color={fallbackColorByState(effectiveState)} />
        </mesh>
        <mesh position={[0, 1.45, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#f5f7fa" />
        </mesh>
        {isHighlighted && (
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.6, 20, 20]} />
            <meshStandardMaterial
              color="#8fe5ff"
              emissive="#2ca6d6"
              emissiveIntensity={0.9}
              transparent
              opacity={0.25}
            />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <primitive object={clonedModel as Group} />
      {isHighlighted && (
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.7, 20, 20]} />
          <meshStandardMaterial
            color="#8fe5ff"
            emissive="#2ca6d6"
            emissiveIntensity={1}
            transparent
            opacity={0.2}
          />
        </mesh>
      )}
      {!hasAllRequiredClips && (
        <mesh position={[0, 1.85, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#ffbf47" emissive="#6b4200" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  );
}
