import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  type AnimationClip,
  GridHelper,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3
} from "three";
import { useWorldStore } from "../state/worldStore";
import { AgentRenderer } from "./agents";
import { assetManager } from "./assets/assetManagerSingleton";
import { IsometricCameraRig } from "./camera/IsometricCameraRig";
import { useInteractionManager } from "./interaction";
import type { InteractionTargetMeta } from "./interaction/interactionTypes";
import type { SceneObjectSpec, SceneRuntimeData } from "./loader";
import type { InstancedAssemblyResult, InstancedObjectGroup } from "./render";
import { useSceneRuntimeProvider } from "./runtime";
import { useHighlightManager } from "./highlight";

const AGENT_MODEL_URL = "/assets/agent1_skeleton.glb";
const AGENT_ANIMATION_URL = "/assets/agent1_animations.glb";
const MIN_VISIBLE_AGENT_SCALE = 0.05;
type RuntimeLoadedObject = SceneRuntimeData["objects"][number];
type RenderPolicyState = {
  castShadow: boolean;
  receiveShadow: boolean;
  cullDistanceM: number | null;
};
const EMPTY_INSTANCED_ASSEMBLY: InstancedAssemblyResult = Object.freeze({
  groups: [],
  fallbackObjectIds: [],
  candidateExclusions: [],
  assemblyExclusions: []
});

function normalizeAgentRootScale(root: Object3D) {
  const minAxis = Math.min(root.scale.x, root.scale.y, root.scale.z);
  if (!Number.isFinite(minAxis) || minAxis <= 0 || minAxis >= MIN_VISIBLE_AGENT_SCALE) {
    return;
  }
  const correction = 1 / minAxis;
  root.scale.multiplyScalar(correction);
  root.updateMatrixWorld(true);
}

function panelCommandName(panel: string | undefined): string | undefined {
  if (!panel) {
    return undefined;
  }
  if (panel === "inbox") {
    return "open_inbox_panel";
  }
  if (panel === "task_board") {
    return "open_task_board_panel";
  }
  if (panel === "deliverables") {
    return "open_deliverables_panel";
  }
  return undefined;
}

function interactionTargetFromObjectSpec(
  object: SceneObjectSpec,
  poiHighlightNodesById: Record<string, string[]>
): InteractionTargetMeta {
  const panel = object.interaction?.panel;
  const panelCommand = panelCommandName(panel);
  const commandName =
    object.interaction?.type === "command"
      ? (object.interaction as { command?: string }).command ?? panelCommand
      : panelCommand;

  if (object.poi_id) {
    return {
      id: object.poi_id,
      type: panel === "deliverables" ? "artifact" : "poi",
      commandName,
      highlightNodes: [
        ...new Set([...(poiHighlightNodesById[object.poi_id] ?? []), ...(object.highlight_nodes ?? [])])
      ]
    };
  }

  return {
    id: object.id,
    type: "object",
    commandName,
    highlightNodes: object.highlight_nodes ?? []
  };
}

function resolveRenderPolicy(spec: SceneObjectSpec): RenderPolicyState {
  const policy = spec.render_policy;
  return {
    castShadow: policy?.cast_shadow ?? true,
    receiveShadow: policy?.receive_shadow ?? true,
    cullDistanceM: policy?.cull_distance_m ?? null
  };
}

function applyShadowPolicy(root: Object3D, castShadow: boolean, receiveShadow: boolean) {
  root.traverse((node) => {
    const candidate = node as Object3D & {
      isMesh?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (!candidate.isMesh) {
      return;
    }
    candidate.castShadow = castShadow;
    candidate.receiveShadow = receiveShadow;
  });
}

function fallbackColorForObject(spec: SceneObjectSpec): string {
  const panel = spec.interaction?.panel;
  if (panel === "inbox") {
    return "#e58e2b";
  }
  if (panel === "task_board") {
    return "#3ba0d9";
  }
  if (panel === "deliverables") {
    return "#6bbf73";
  }
  return "#8b97a6";
}

function fallbackSizeForObject(spec: SceneObjectSpec): [number, number, number] {
  const collider = spec.collider;
  if (
    collider &&
    typeof collider === "object" &&
    collider.type === "box" &&
    Array.isArray(collider.size) &&
    collider.size.length === 3
  ) {
    return [collider.size[0], collider.size[1], collider.size[2]];
  }
  return [0.8, 0.8, 0.8];
}

function resolveHighlightMarkerPositions(
  root: Object3D,
  nodeNames: string[] | undefined
): [number, number, number][] {
  const markerPositions: [number, number, number][] = [];
  const worldPos = new Vector3();

  if (Array.isArray(nodeNames) && nodeNames.length > 0) {
    for (const nodeName of nodeNames) {
      const node = root.getObjectByName(nodeName);
      if (!node) {
        continue;
      }
      node.getWorldPosition(worldPos);
      root.worldToLocal(worldPos);
      markerPositions.push([worldPos.x, worldPos.y, worldPos.z]);
    }
  }

  if (markerPositions.length > 0) {
    return markerPositions;
  }

  root.getWorldPosition(worldPos);
  root.worldToLocal(worldPos);
  return [[worldPos.x, worldPos.y + 0.4, worldPos.z]];
}

function PoiHighlightMarkers({ positions }: { positions: [number, number, number][] }) {
  const instancedRef = useRef<InstancedMesh>(null);
  const markerMatrix = useMemo(() => new Matrix4(), []);

  useLayoutEffect(() => {
    const instanced = instancedRef.current;
    if (!instanced || positions.length <= 1) {
      return;
    }

    for (let index = 0; index < positions.length; index += 1) {
      const [x, y, z] = positions[index];
      markerMatrix.makeTranslation(x, y, z);
      instanced.setMatrixAt(index, markerMatrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  }, [markerMatrix, positions]);

  if (positions.length === 0) {
    return null;
  }

  if (positions.length === 1) {
    return (
      <mesh position={positions[0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#ffd86b" emissive="#ff9f1a" emissiveIntensity={0.8} />
      </mesh>
    );
  }

  return (
    <instancedMesh ref={instancedRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.1, 12, 12]} />
      <meshStandardMaterial color="#ffd86b" emissive="#ff9f1a" emissiveIntensity={0.8} />
    </instancedMesh>
  );
}

function BlockerConeSignal({ active }: { active: boolean }) {
  const ringRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!active || !ringRef.current) {
      return;
    }
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
    const scale = 1 + pulse * 0.25;
    ringRef.current.scale.set(scale, 1, scale);
    const material = ringRef.current.material as MeshStandardMaterial | MeshStandardMaterial[];
    if (!Array.isArray(material)) {
      material.emissiveIntensity = 0.7 + pulse * 0.6;
      material.opacity = 0.25 + pulse * 0.2;
    }
  });

  if (!active) {
    return null;
  }

  return (
    <group position={[0, 0.55, 0]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.05, 12, 28]} />
        <meshStandardMaterial
          color="#ff9152"
          emissive="#ff3b1f"
          emissiveIntensity={1}
          transparent
          opacity={0.3}
        />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#ffd172" emissive="#ff6a00" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function InstancedObjectBatch({ group }: { group: InstancedObjectGroup }) {
  const instancedRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = instancedRef.current;
    if (!instanced) {
      return;
    }
    for (let index = 0; index < group.matrices.length; index += 1) {
      const matrix = group.matrices[index];
      if (!matrix) {
        continue;
      }
      instanced.setMatrixAt(index, matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [group.matrices]);

  return (
    <instancedMesh
      ref={instancedRef}
      args={[group.geometry, group.material, group.matrices.length]}
      castShadow={group.renderPolicy.castShadow}
      receiveShadow={group.renderPolicy.receiveShadow}
    />
  );
}

const LIGHTING_BUDGET = Object.freeze({
  backgroundColor: "#263241",
  fogColor: "#2a3442",
  fogNear: 14,
  fogFar: 46,
  groundColor: "#3a4658",
  ambientIntensity: 0.82,
  hemisphereSkyColor: "#eadcc1",
  hemisphereGroundColor: "#2b3645",
  hemisphereIntensity: 0.62,
  keyColor: "#ffd6a3",
  keyIntensity: 1.32,
  keyPosition: [4.8, 7.4, 3.1] as [number, number, number],
  fillColor: "#a8c3e3",
  fillIntensity: 0.44,
  fillPosition: [-4.8, 5.6, -3.8] as [number, number, number],
  keyShadowMapSize: 512
});

export function OfficeScene() {
  const sceneRuntime = useSceneRuntimeProvider();
  const runtimeData = sceneRuntime.snapshot.runtimeData;

  const poiHighlightNodesById = sceneRuntime.snapshot.derived?.poiHighlightNodesById ?? {};

  const loadedObjectEntries = useMemo(() => {
    if (!runtimeData) {
      return [] as Array<{
        loaded: RuntimeLoadedObject;
        spec: SceneObjectSpec;
        renderPolicy: RenderPolicyState;
      }>;
    }

    const entries: Array<{
      loaded: RuntimeLoadedObject;
      spec: SceneObjectSpec;
      renderPolicy: RenderPolicyState;
    }> = [];
    for (const loaded of runtimeData.objects) {
      const spec = runtimeData.objectsById[loaded.id];
      if (!spec) {
        continue;
      }
      entries.push({ loaded, spec, renderPolicy: resolveRenderPolicy(spec) });
    }
    return entries;
  }, [runtimeData]);

  const instancedAssembly =
    sceneRuntime.snapshot.derived?.instancedAssembly ?? EMPTY_INSTANCED_ASSEMBLY;

  const fallbackLoadedObjectEntries = useMemo(() => {
    const fallbackObjectIdSet = new Set(instancedAssembly.fallbackObjectIds);
    return loadedObjectEntries.filter(({ loaded }) => fallbackObjectIdSet.has(loaded.id));
  }, [instancedAssembly.fallbackObjectIds, loadedObjectEntries]);

  const missingObjectSpecs = useMemo(() => {
    if (!runtimeData) {
      return [] as SceneObjectSpec[];
    }

    const loadedIds = new Set(runtimeData.objects.map((object) => object.id));
    return Object.values(runtimeData.objectsById).filter((spec) => !loadedIds.has(spec.id));
  }, [runtimeData]);

  const runtimeShell = runtimeData?.shell.root ?? null;

  const grid = useMemo(() => new GridHelper(20, 20, "#5f6c7b", "#273240"), []);
  const [agentModel, setAgentModel] = useState<Object3D | null>(null);
  const [agentAnimations, setAgentAnimations] = useState<AnimationClip[] | null>(null);
  const agents = useWorldStore((state) => Object.values(state.agents));
  const agentGoals = useWorldStore((state) => state.agentGoals);
  const blockedTaskCount = useWorldStore(
    (state) => Object.values(state.tasks).filter((task) => task.status === "blocked").length
  );
  const interactionHandlers = useInteractionManager();
  const highlightState = useHighlightManager();
  const cullProbeWorldPos = useMemo(() => new Vector3(), []);

  useEffect(() => {
    let active = true;

    Promise.all([assetManager.load(AGENT_MODEL_URL), assetManager.load(AGENT_ANIMATION_URL)])
      .then(([skeletonGltf, animationGltf]) => {
        if (!active) {
          return;
        }
        normalizeAgentRootScale(skeletonGltf.scene);
        setAgentModel(skeletonGltf.scene);
        setAgentAnimations(animationGltf.animations);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[OfficeScene] Failed to load agent GLB assets (${AGENT_MODEL_URL}, ${AGENT_ANIMATION_URL}): ${message}`
        );
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    for (const { loaded, renderPolicy } of fallbackLoadedObjectEntries) {
      applyShadowPolicy(loaded.root, renderPolicy.castShadow, renderPolicy.receiveShadow);
    }
  }, [fallbackLoadedObjectEntries]);

  useFrame((state) => {
    for (const { loaded, renderPolicy } of fallbackLoadedObjectEntries) {
      if (renderPolicy.cullDistanceM === null) {
        loaded.root.visible = true;
        continue;
      }
      loaded.root.getWorldPosition(cullProbeWorldPos);
      loaded.root.visible = state.camera.position.distanceTo(cullProbeWorldPos) <= renderPolicy.cullDistanceM;
    }
  });

  return (
    <>
      <IsometricCameraRig />
      <color attach="background" args={[LIGHTING_BUDGET.backgroundColor]} />
      <fog attach="fog" args={[LIGHTING_BUDGET.fogColor, LIGHTING_BUDGET.fogNear, LIGHTING_BUDGET.fogFar]} />
      <ambientLight intensity={LIGHTING_BUDGET.ambientIntensity} />
      <hemisphereLight
        args={[
          LIGHTING_BUDGET.hemisphereSkyColor,
          LIGHTING_BUDGET.hemisphereGroundColor,
          LIGHTING_BUDGET.hemisphereIntensity
        ]}
      />
      <directionalLight
        castShadow
        color={LIGHTING_BUDGET.keyColor}
        intensity={LIGHTING_BUDGET.keyIntensity}
        position={LIGHTING_BUDGET.keyPosition}
        shadow-mapSize={[LIGHTING_BUDGET.keyShadowMapSize, LIGHTING_BUDGET.keyShadowMapSize]}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-normalBias={0.03}
      />
      <directionalLight
        color={LIGHTING_BUDGET.fillColor}
        intensity={LIGHTING_BUDGET.fillIntensity}
        position={LIGHTING_BUDGET.fillPosition}
      />
      <group
        onPointerMove={interactionHandlers.onPointerMove}
        onClick={interactionHandlers.onClick}
        onPointerOut={interactionHandlers.onPointerOut}
      >
        <primitive object={grid} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          userData={{
            interactionTarget: {
              id: "ground_nav_surface",
              type: "object"
            }
          }}
        >
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color={LIGHTING_BUDGET.groundColor} />
        </mesh>

        {runtimeShell ? (
          <group
            userData={{
              interactionTarget: {
                id: "office_shell",
                type: "object"
              }
            }}
          >
            <primitive object={runtimeShell} />
          </group>
        ) : null}

        {instancedAssembly.groups.map((group) => (
          <InstancedObjectBatch key={`instanced:${group.compatibilityKey}`} group={group} />
        ))}

        {fallbackLoadedObjectEntries.map(({ loaded, spec }) => {
          const target = interactionTargetFromObjectSpec(spec, poiHighlightNodesById);
          const isPoiHighlighted =
            target.type !== "object" && highlightState.highlightedPoiId === target.id;
          const markers = isPoiHighlighted
            ? resolveHighlightMarkerPositions(loaded.root, target.highlightNodes)
            : [];
          return (
            <group key={loaded.id} userData={{ interactionTarget: target }}>
              <primitive object={loaded.root} />
              <PoiHighlightMarkers positions={markers} />
              {loaded.id === "delivery_cone_marker" ? (
                <BlockerConeSignal active={blockedTaskCount > 0} />
              ) : null}
            </group>
          );
        })}

        {missingObjectSpecs.map((spec) => {
          const target = interactionTargetFromObjectSpec(spec, poiHighlightNodesById);
          const renderPolicy = resolveRenderPolicy(spec);
          const isPoiHighlighted =
            target.type !== "object" && highlightState.highlightedPoiId === target.id;
          const size = fallbackSizeForObject(spec);
          return (
            <group key={`${spec.id}-fallback`} userData={{ interactionTarget: target }}>
              <mesh
                position={spec.transform.pos}
                castShadow={renderPolicy.castShadow}
                receiveShadow={renderPolicy.receiveShadow}
              >
                <boxGeometry args={size} />
                <meshStandardMaterial color={fallbackColorForObject(spec)} />
              </mesh>
              {isPoiHighlighted ? (
                <mesh position={spec.transform.pos}>
                  <sphereGeometry args={[0.35, 18, 18]} />
                  <meshStandardMaterial
                    color="#ffd86b"
                    emissive="#ff9f1a"
                    emissiveIntensity={0.9}
                    transparent
                    opacity={0.25}
                  />
                </mesh>
              ) : null}
              {spec.id === "delivery_cone_marker" ? (
                <group position={spec.transform.pos}>
                  <BlockerConeSignal active={blockedTaskCount > 0} />
                </group>
              ) : null}
            </group>
          );
        })}

        {!runtimeData ? (
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[2, 1, 2]} />
            <meshStandardMaterial color="#2f8f83" />
          </mesh>
        ) : null}

        {agents.map((agent) => (
          <group
            key={agent.id}
            userData={{
              interactionTarget: {
                id: agent.id,
                type: "agent",
                commandName: "open_agent_inspector"
              }
            }}
          >
            <AgentRenderer
              agentId={agent.id}
              state={agent.state}
              position={agent.pos}
              goal={agentGoals[agent.id]}
              model={agentModel}
              clips={agentAnimations ?? undefined}
              isHighlighted={highlightState.participantAgentIds.includes(agent.id)}
            />
          </group>
        ))}
      </group>
    </>
  );
}
