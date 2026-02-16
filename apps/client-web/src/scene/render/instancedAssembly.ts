import { Matrix4, type BufferGeometry, type Material, type Object3D } from "three";
import type { SceneObjectSpec, SceneRuntimeData } from "../loader";
import {
  detectInstancingCandidates,
  type InstancingCandidateExclusion,
  type InstancingCompatibilityPolicy
} from "./instancingCandidates";

export type RuntimeLoadedObject = SceneRuntimeData["objects"][number];

export interface InstancedAssemblyEntry {
  loaded: RuntimeLoadedObject;
  spec: SceneObjectSpec;
}

export type InstancedAssemblyExclusionReason =
  | "missing_loaded_object"
  | "cull_distance_policy"
  | "mesh_count_invalid"
  | "multi_material_mesh"
  | "geometry_mismatch"
  | "material_mismatch";

export interface InstancedAssemblyExclusion {
  objectId: string;
  reason: InstancedAssemblyExclusionReason;
  details?: Record<string, string>;
}

export interface InstancedObjectGroup {
  instanceGroup: string;
  compatibilityKey: string;
  sourceUrl: string;
  renderPolicy: InstancingCompatibilityPolicy;
  objectIds: string[];
  geometry: BufferGeometry;
  material: Material;
  matrices: Matrix4[];
}

export interface InstancedAssemblyResult {
  groups: InstancedObjectGroup[];
  fallbackObjectIds: string[];
  candidateExclusions: InstancingCandidateExclusion[];
  assemblyExclusions: InstancedAssemblyExclusion[];
}

interface MeshCandidate extends Object3D {
  isMesh?: boolean;
  geometry?: BufferGeometry;
  material?: Material | Material[];
}

type MeshExtractionResult =
  | {
      matrix: Matrix4;
      geometry: BufferGeometry;
      material: Material;
    }
  | {
      reason: "mesh_count_invalid" | "multi_material_mesh";
      details?: Record<string, string>;
    };

interface ExtractedMesh {
  objectId: string;
  matrix: Matrix4;
  geometry: BufferGeometry;
  material: Material;
}

function sortObjectAndReason(
  left: { objectId: string; reason: string },
  right: { objectId: string; reason: string }
): number {
  const idCompare = left.objectId.localeCompare(right.objectId);
  if (idCompare !== 0) {
    return idCompare;
  }
  return left.reason.localeCompare(right.reason);
}

function extractSingleMesh(root: Object3D): MeshExtractionResult {
  root.updateMatrixWorld(true);

  const meshes: MeshCandidate[] = [];

  root.traverse((node) => {
    const candidate = node as MeshCandidate;
    if (!candidate.isMesh) {
      return;
    }
    meshes.push(candidate);
  });

  if (meshes.length !== 1) {
    return {
      reason: "mesh_count_invalid",
      details: {
        mesh_count: String(meshes.length)
      }
    };
  }

  const mesh = meshes[0];
  if (!mesh) {
    return {
      reason: "mesh_count_invalid",
      details: {
        mesh_count: String(meshes.length)
      }
    };
  }

  if (!mesh.material || Array.isArray(mesh.material)) {
    return {
      reason: "multi_material_mesh"
    };
  }

  if (!mesh.geometry) {
    return {
      reason: "mesh_count_invalid",
      details: {
        mesh_count: String(meshes.length),
        geometry: "missing"
      }
    };
  }

  return {
    matrix: mesh.matrixWorld.clone(),
    geometry: mesh.geometry,
    material: mesh.material
  };
}

export function buildInstancedObjectGroups(
  entries: readonly InstancedAssemblyEntry[]
): InstancedAssemblyResult {
  const entryById = new Map<string, InstancedAssemblyEntry>();
  for (const entry of entries) {
    entryById.set(entry.loaded.id, entry);
  }

  const candidateDetection = detectInstancingCandidates(entries.map((entry) => entry.spec));
  const assemblyExclusions: InstancedAssemblyExclusion[] = [];
  const groups: InstancedObjectGroup[] = [];
  const fallbackObjectIdSet = new Set(entries.map((entry) => entry.loaded.id));

  for (const candidateGroup of candidateDetection.groups) {
    if (candidateGroup.renderPolicy.cullDistanceM !== null) {
      for (const objectId of candidateGroup.objectIds) {
        assemblyExclusions.push({
          objectId,
          reason: "cull_distance_policy",
          details: {
            cull_distance_m: String(candidateGroup.renderPolicy.cullDistanceM)
          }
        });
      }
      continue;
    }

    const extractedMeshes: ExtractedMesh[] = [];
    let candidateFailed = false;

    for (const objectId of candidateGroup.objectIds) {
      const entry = entryById.get(objectId);
      if (!entry) {
        assemblyExclusions.push({
          objectId,
          reason: "missing_loaded_object"
        });
        candidateFailed = true;
        continue;
      }

      const extracted = extractSingleMesh(entry.loaded.root);
      if ("reason" in extracted) {
        assemblyExclusions.push({
          objectId,
          reason: extracted.reason,
          details: extracted.details
        });
        candidateFailed = true;
        continue;
      }

      extractedMeshes.push({
        objectId,
        ...extracted
      });
    }

    if (candidateFailed) {
      continue;
    }

    const base = extractedMeshes[0];
    if (!base) {
      continue;
    }

    let geometryOrMaterialMismatch = false;
    for (let index = 1; index < extractedMeshes.length; index += 1) {
      const mesh = extractedMeshes[index];
      if (!mesh) {
        continue;
      }
      if (mesh.geometry !== base.geometry) {
        assemblyExclusions.push({
          objectId: mesh.objectId,
          reason: "geometry_mismatch",
          details: {
            expected_geometry_uuid: base.geometry.uuid,
            actual_geometry_uuid: mesh.geometry.uuid
          }
        });
        geometryOrMaterialMismatch = true;
        continue;
      }
      if (mesh.material !== base.material) {
        assemblyExclusions.push({
          objectId: mesh.objectId,
          reason: "material_mismatch",
          details: {
            expected_material_uuid: base.material.uuid,
            actual_material_uuid: mesh.material.uuid
          }
        });
        geometryOrMaterialMismatch = true;
      }
    }

    if (geometryOrMaterialMismatch) {
      continue;
    }

    const matrices = extractedMeshes.map((mesh) => mesh.matrix);
    groups.push({
      instanceGroup: candidateGroup.instanceGroup,
      compatibilityKey: candidateGroup.compatibilityKey,
      sourceUrl: candidateGroup.sourceUrl,
      renderPolicy: candidateGroup.renderPolicy,
      objectIds: candidateGroup.objectIds,
      geometry: base.geometry,
      material: base.material,
      matrices
    });

    for (const objectId of candidateGroup.objectIds) {
      fallbackObjectIdSet.delete(objectId);
    }
  }

  assemblyExclusions.sort(sortObjectAndReason);

  return {
    groups,
    fallbackObjectIds: [...fallbackObjectIdSet].sort((left, right) =>
      left.localeCompare(right)
    ),
    candidateExclusions: candidateDetection.exclusions,
    assemblyExclusions
  };
}
