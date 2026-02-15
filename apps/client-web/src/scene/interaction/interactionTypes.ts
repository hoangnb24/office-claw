import type { Intersection, Object3D, Vector3 } from "three";

export type InteractionTargetType = "poi" | "agent" | "artifact" | "object";

export interface InteractionTargetMeta {
  id: string;
  type: InteractionTargetType;
  commandName?: string;
  commandPayload?: Record<string, unknown>;
  highlightNodes?: string[];
}

export interface InteractionHit {
  target: InteractionTargetMeta;
  point: Vector3;
  distance: number;
  object: Object3D;
  intersection: Intersection<Object3D>;
}

export interface InteractionCommandIntent {
  name: string;
  sourceId: string;
  sourceType: InteractionTargetType;
  payload?: Record<string, unknown>;
}

export interface InteractionDispatch {
  onHoverChanged?: (hit: InteractionHit | null) => void;
  onTargetSelected?: (hit: InteractionHit) => void;
  onCommandIntent?: (intent: InteractionCommandIntent) => void;
}
