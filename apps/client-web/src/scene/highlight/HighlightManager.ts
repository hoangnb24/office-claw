import { Color, Material, Mesh, Object3D, Scene } from "three";

interface FocusInput {
  poiId: string | null;
  participantAgentIds: string[];
}

interface HighlightStyle {
  color: Color;
  emissiveIntensity: number;
  colorMix: number;
}

interface AppliedMaterial {
  mesh: Mesh;
  original: Material | Material[];
  applied: Material[];
}

interface InteractionTargetMeta {
  id?: string;
  type?: string;
  poiId?: string;
}

const POI_STYLE: HighlightStyle = {
  color: new Color("#ffd166"),
  emissiveIntensity: 0.95,
  colorMix: 0.2
};

const PARTICIPANT_STYLE: HighlightStyle = {
  color: new Color("#62c7ff"),
  emissiveIntensity: 0.85,
  colorMix: 0.18
};

function interactionTargetFromObject(object: Object3D): InteractionTargetMeta | null {
  const target = object.userData?.interactionTarget;
  if (!target || typeof target !== "object") {
    return null;
  }
  return target as InteractionTargetMeta;
}

function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    if ((child as Mesh).isMesh) {
      meshes.push(child as Mesh);
    }
  });
  return meshes;
}

function uniqueMeshes(meshes: Mesh[]): Mesh[] {
  const seen = new Set<string>();
  return meshes.filter((mesh) => {
    if (seen.has(mesh.uuid)) {
      return false;
    }
    seen.add(mesh.uuid);
    return true;
  });
}

function cloneWithStyle(material: Material, style: HighlightStyle): Material {
  const cloned = material.clone();
  const candidate = cloned as Material & {
    color?: Color;
    emissive?: Color;
    emissiveIntensity?: number;
  };

  if (candidate.color instanceof Color) {
    candidate.color = candidate.color.clone().lerp(style.color, style.colorMix);
  }
  if (candidate.emissive instanceof Color) {
    candidate.emissive = style.color.clone();
    candidate.emissiveIntensity = style.emissiveIntensity;
  }
  return cloned;
}

function highlightMeshes(meshes: Mesh[], style: HighlightStyle): AppliedMaterial[] {
  const applied: AppliedMaterial[] = [];

  for (const mesh of uniqueMeshes(meshes)) {
    const original = mesh.material;
    if (!original) {
      continue;
    }

    const originalList = Array.isArray(original) ? original : [original];
    const styled = originalList.map((material) => cloneWithStyle(material, style));

    mesh.material = Array.isArray(original) ? styled : styled[0];
    applied.push({
      mesh,
      original,
      applied: styled
    });
  }

  return applied;
}

function collectPoiMeshes(root: Object3D, nodeNames: string[]): Mesh[] {
  const fromNodes: Mesh[] = [];
  for (const nodeName of nodeNames) {
    const node = root.getObjectByName(nodeName);
    if (!node) {
      continue;
    }
    fromNodes.push(...collectMeshes(node));
  }

  if (fromNodes.length > 0) {
    return uniqueMeshes(fromNodes);
  }

  return collectMeshes(root);
}

export class HighlightManager {
  private readonly poiHighlightNodesById: Record<string, string[]>;
  private applied: AppliedMaterial[] = [];
  private lastFocusKey = "";

  constructor(poiHighlightNodesById: Record<string, string[]>) {
    this.poiHighlightNodesById = poiHighlightNodesById;
  }

  applyFocus(scene: Scene, focus: FocusInput): void {
    const participantsKey = [...new Set(focus.participantAgentIds)].sort().join(",");
    const focusKey = `${focus.poiId ?? "none"}|${participantsKey}`;
    if (focusKey === this.lastFocusKey) {
      return;
    }

    this.clear();
    this.lastFocusKey = focusKey;

    if (!focus.poiId && !participantsKey) {
      return;
    }

    if (focus.poiId) {
      const roots = this.findPoiRoots(scene, focus.poiId);
      const nodeNames = this.poiHighlightNodesById[focus.poiId] ?? [];
      for (const root of roots) {
        this.applied.push(...highlightMeshes(collectPoiMeshes(root, nodeNames), POI_STYLE));
      }
    }

    const participants = new Set(focus.participantAgentIds);
    if (participants.size > 0) {
      const roots = this.findParticipantRoots(scene, participants);
      for (const root of roots) {
        this.applied.push(...highlightMeshes(collectMeshes(root), PARTICIPANT_STYLE));
      }
    }
  }

  clear(): void {
    for (const item of this.applied) {
      item.mesh.material = item.original;
      for (const material of item.applied) {
        material.dispose();
      }
    }
    this.applied = [];
    this.lastFocusKey = "";
  }

  private findPoiRoots(scene: Scene, poiId: string): Object3D[] {
    const roots: Object3D[] = [];
    scene.traverse((object) => {
      const target = interactionTargetFromObject(object);
      if (!target) {
        return;
      }

      const targetId = typeof target.id === "string" ? target.id : null;
      const targetPoiId = typeof target.poiId === "string" ? target.poiId : null;
      if (targetId === poiId || targetPoiId === poiId) {
        roots.push(object);
      }
    });
    return roots;
  }

  private findParticipantRoots(scene: Scene, participantIds: Set<string>): Object3D[] {
    const roots: Object3D[] = [];
    scene.traverse((object) => {
      const target = interactionTargetFromObject(object);
      if (!target || target.type !== "agent") {
        return;
      }
      if (typeof target.id === "string" && participantIds.has(target.id)) {
        roots.push(object);
      }
    });
    return roots;
  }
}
