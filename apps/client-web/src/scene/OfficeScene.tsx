import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type AnimationClip, GridHelper, InstancedMesh, Matrix4, Object3D, Vector3 } from "three";
import { useWorldStore } from "../state/worldStore";
import { AgentRenderer } from "./agents";
import { useSceneAssets } from "./assets";
import { assetManager } from "./assets/assetManagerSingleton";
import { IsometricCameraRig } from "./camera/IsometricCameraRig";
import { poiHighlightNodesById, useHighlightManager } from "./highlight";
import { useInteractionManager } from "./interaction";

const AGENT_MODEL_URL = "/assets/agents/agent1_skeleton.glb";
const AGENT_ANIMATION_URL = "/assets/agents/agent1_animations.glb";
const MIN_VISIBLE_AGENT_SCALE = 0.05;

function normalizeAgentRootScale(root: Object3D) {
  const minAxis = Math.min(root.scale.x, root.scale.y, root.scale.z);
  if (!Number.isFinite(minAxis) || minAxis <= 0 || minAxis >= MIN_VISIBLE_AGENT_SCALE) {
    return;
  }
  const correction = 1 / minAxis;
  root.scale.multiplyScalar(correction);
  root.updateMatrixWorld(true);
}

function interactionMetaForAsset(assetId: string) {
  if (assetId === "prop_inbox") {
    return {
      id: "poi_reception_inbox",
      type: "poi" as const,
      poiId: "poi_reception_inbox",
      commandName: "open_inbox_panel",
      highlightNodes: poiHighlightNodesById.poi_reception_inbox ?? []
    };
  }
  if (assetId === "prop_task_board") {
    return {
      id: "poi_task_board",
      type: "poi" as const,
      poiId: "poi_task_board",
      commandName: "open_task_board_panel",
      highlightNodes: poiHighlightNodesById.poi_task_board ?? []
    };
  }
  if (assetId === "prop_delivery_shelf") {
    return {
      id: "poi_delivery_shelf",
      type: "artifact" as const,
      poiId: "poi_delivery_shelf",
      commandName: "open_deliverables_panel",
      highlightNodes: poiHighlightNodesById.poi_delivery_shelf ?? []
    };
  }

  return {
    id: assetId,
    type: "object" as const
  };
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
        <meshStandardMaterial
          color="#ffd86b"
          emissive="#ff9f1a"
          emissiveIntensity={0.8}
        />
      </mesh>
    );
  }

  return (
    <instancedMesh ref={instancedRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.1, 12, 12]} />
      <meshStandardMaterial
        color="#ffd86b"
        emissive="#ff9f1a"
        emissiveIntensity={0.8}
      />
    </instancedMesh>
  );
}

const LIGHTING_BUDGET = Object.freeze({
  ambientIntensity: 0.62,
  hemisphereIntensity: 0.28,
  keyIntensity: 0.72,
  keyPosition: [5, 8, 3] as [number, number, number],
  keyShadowMapSize: 512
});

export function OfficeScene() {
  const grid = useMemo(() => new GridHelper(20, 20, "#5f6c7b", "#273240"), []);
  const sceneAssets = useSceneAssets();
  const [agentModel, setAgentModel] = useState<Object3D | null>(null);
  const [agentAnimations, setAgentAnimations] = useState<AnimationClip[] | null>(null);
  const loadedSceneAssets = useMemo(
    () => sceneAssets.filter((asset) => asset.status === "loaded" && asset.object),
    [sceneAssets]
  );
  const failedSceneAssets = useMemo(
    () => sceneAssets.filter((asset) => asset.status === "failed" && !asset.spec.critical),
    [sceneAssets]
  );
  const agents = useWorldStore((state) => Object.values(state.agents));
  const agentGoals = useWorldStore((state) => state.agentGoals);
  const interactionHandlers = useInteractionManager();
  const highlightState = useHighlightManager();

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

  return (
    <>
      <IsometricCameraRig />
      <color attach="background" args={["#13161f"]} />
      <ambientLight intensity={LIGHTING_BUDGET.ambientIntensity} />
      <hemisphereLight
        args={["#9db3d1", "#171d2a", LIGHTING_BUDGET.hemisphereIntensity]}
      />
      <directionalLight
        castShadow
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
          <meshStandardMaterial color="#1e2937" />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[2, 1, 2]} />
          <meshStandardMaterial color="#2f8f83" />
        </mesh>
        {loadedSceneAssets.map((asset) => {
            const target = interactionMetaForAsset(asset.spec.id);
            const isPoiHighlighted = highlightState.highlightedPoiId === target.id;
            const markers = isPoiHighlighted
              ? resolveHighlightMarkerPositions(asset.object!, target.highlightNodes)
              : [];
            return (
              <group
                key={asset.spec.id}
                userData={{ interactionTarget: target }}
              >
                <primitive object={asset.object!} />
                <PoiHighlightMarkers positions={markers} />
              </group>
            );
          })}
        {failedSceneAssets.map((asset) => {
            const target = interactionMetaForAsset(asset.spec.id);
            const isPoiHighlighted = highlightState.highlightedPoiId === target.id;
            return (
              <group
                key={`${asset.spec.id}-fallback`}
                userData={{ interactionTarget: target }}
              >
                <mesh position={asset.spec.fallback.position}>
                  <boxGeometry args={asset.spec.fallback.size} />
                  <meshStandardMaterial color={asset.spec.fallback.color} />
                </mesh>
                {isPoiHighlighted && (
                  <mesh position={asset.spec.fallback.position}>
                    <sphereGeometry args={[0.35, 18, 18]} />
                    <meshStandardMaterial
                      color="#ffd86b"
                      emissive="#ff9f1a"
                      emissiveIntensity={0.9}
                      transparent
                      opacity={0.25}
                    />
                  </mesh>
                )}
              </group>
            );
          })}
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
