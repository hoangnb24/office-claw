import { Camera, Object3D, Raycaster, Scene, Vector2 } from "three";
import type {
  InteractionCommandIntent,
  InteractionDispatch,
  InteractionHit,
  InteractionTargetMeta
} from "./interactionTypes";

export interface InteractionManagerOptions {
  hoverIntervalMs?: number;
  dispatch?: InteractionDispatch;
}

export class InteractionManager {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly hoverIntervalMs: number;
  private readonly dispatch?: InteractionDispatch;

  private lastHoverSampleMs = 0;
  private hoveredTargetId: string | null = null;

  constructor(options: InteractionManagerOptions = {}) {
    this.hoverIntervalMs = options.hoverIntervalMs ?? 60;
    this.dispatch = options.dispatch;
  }

  resolveHover(
    pointerNdc: { x: number; y: number },
    camera: Camera,
    scene: Scene,
    nowMs = performance.now()
  ): InteractionHit | null {
    if (nowMs - this.lastHoverSampleMs < this.hoverIntervalMs) {
      return null;
    }
    this.lastHoverSampleMs = nowMs;

    const hit = this.resolveRaycast(pointerNdc, camera, scene);
    const nextId = hit?.target.id ?? null;
    if (nextId !== this.hoveredTargetId) {
      this.hoveredTargetId = nextId;
      this.dispatch?.onHoverChanged?.(hit);
    }
    return hit;
  }

  resolveClick(
    pointerNdc: { x: number; y: number },
    camera: Camera,
    scene: Scene
  ): InteractionHit | null {
    const hit = this.resolveRaycast(pointerNdc, camera, scene);
    if (!hit) {
      return null;
    }

    this.dispatch?.onTargetSelected?.(hit);
    const intent = this.intentFromHit(hit);
    if (intent) {
      this.dispatch?.onCommandIntent?.(intent);
    }
    return hit;
  }

  clearHover() {
    if (this.hoveredTargetId !== null) {
      this.hoveredTargetId = null;
      this.dispatch?.onHoverChanged?.(null);
    }
  }

  private resolveRaycast(
    pointerNdc: { x: number; y: number },
    camera: Camera,
    scene: Scene
  ): InteractionHit | null {
    this.pointer.set(pointerNdc.x, pointerNdc.y);
    this.raycaster.setFromCamera(this.pointer, camera);

    const intersections = this.raycaster.intersectObjects(scene.children, true);
    for (const intersection of intersections) {
      const target = this.targetMetaFromObject(intersection.object);
      if (!target) {
        continue;
      }
      return {
        target,
        point: intersection.point.clone(),
        distance: intersection.distance,
        object: intersection.object,
        intersection
      };
    }

    return null;
  }

  private targetMetaFromObject(object: Object3D): InteractionTargetMeta | null {
    let cursor: Object3D | null = object;
    while (cursor) {
      const value = cursor.userData?.interactionTarget;
      if (value && typeof value === "object") {
        const id = typeof value.id === "string" ? value.id : null;
        const type =
          value.type === "poi" ||
          value.type === "agent" ||
          value.type === "artifact" ||
          value.type === "object"
            ? value.type
            : null;

        if (id && type) {
          return {
            id,
            type,
            commandName:
              typeof value.commandName === "string" ? value.commandName : undefined,
            commandPayload:
              value.commandPayload && typeof value.commandPayload === "object"
                ? (value.commandPayload as Record<string, unknown>)
                : undefined,
            highlightNodes: Array.isArray(value.highlightNodes)
              ? value.highlightNodes.filter((node: unknown): node is string => typeof node === "string")
              : undefined
          };
        }
      }
      cursor = cursor.parent;
    }
    return null;
  }

  private intentFromHit(hit: InteractionHit): InteractionCommandIntent | null {
    if (!hit.target.commandName) {
      return null;
    }
    return {
      name: hit.target.commandName,
      sourceId: hit.target.id,
      sourceType: hit.target.type,
      payload: hit.target.commandPayload
    };
  }
}
