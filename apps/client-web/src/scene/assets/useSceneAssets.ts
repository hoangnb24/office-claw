import { useEffect, useState } from "react";
import type { Mesh, Object3D } from "three";
import { useWorldStore } from "../../state/worldStore";
import { assetManager } from "./assetManagerSingleton";
import { sceneAssetCatalog, type SceneAssetSpec } from "./sceneAssetCatalog";

export interface SceneAssetEntry {
  spec: SceneAssetSpec;
  status: "loading" | "loaded" | "failed";
  object?: Object3D;
  error?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown asset loading error";
}

function isMeshNode(node: Object3D): node is Mesh {
  return (node as Mesh).isMesh === true;
}

function applyRenderBudget(root: Object3D, spec: SceneAssetSpec): void {
  let remainingCasters = Math.max(0, spec.renderBudget.shadowCasters);
  let remainingReceivers = Math.max(0, spec.renderBudget.shadowReceivers);

  root.traverse((node) => {
    if (!isMeshNode(node)) {
      return;
    }

    const nextCastShadow = remainingCasters > 0;
    const nextReceiveShadow = remainingReceivers > 0;

    node.castShadow = nextCastShadow;
    node.receiveShadow = nextReceiveShadow;

    if (nextCastShadow) {
      remainingCasters -= 1;
    }
    if (nextReceiveShadow) {
      remainingReceivers -= 1;
    }
  });

  root.updateMatrixWorld(true);
}

export function useSceneAssets() {
  const [entries, setEntries] = useState<SceneAssetEntry[]>(() =>
    sceneAssetCatalog.map((spec) => ({ spec, status: "loading" }))
  );

  useEffect(() => {
    let active = true;

    useWorldStore.getState().beginAssetStartup(sceneAssetCatalog.length);
    setEntries(sceneAssetCatalog.map((spec) => ({ spec, status: "loading" })));

    for (const spec of sceneAssetCatalog) {
      const startedAtMs = Date.now();
      assetManager
        .clone(spec.url)
        .then(({ root }) => {
          if (!active) {
            return;
          }

          root.position.set(...spec.position);
          root.scale.set(...spec.scale);
          applyRenderBudget(root, spec);

          setEntries((current) =>
            current.map((entry) =>
              entry.spec.id === spec.id
                ? {
                    ...entry,
                    status: "loaded",
                    object: root,
                    error: undefined
                  }
                : entry
            )
          );

          const durationMs = Math.max(0, Date.now() - startedAtMs);
          useWorldStore.getState().markAssetLoaded(spec.id, durationMs);
        })
        .catch((error) => {
          if (!active) {
            return;
          }

          const message = errorMessage(error);

          setEntries((current) =>
            current.map((entry) =>
              entry.spec.id === spec.id
                ? {
                    ...entry,
                    status: "failed",
                    error: message,
                    object: undefined
                  }
                : entry
            )
          );

          const durationMs = Math.max(0, Date.now() - startedAtMs);
          useWorldStore.getState().markAssetFailed(spec.id, durationMs, spec.critical, `${spec.id}: ${message}`);
        });
    }

    return () => {
      active = false;
    };
  }, []);

  return entries;
}
