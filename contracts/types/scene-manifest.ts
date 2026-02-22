import type { PoiId } from "./domain";

export type Vector3 = [number, number, number];
export type Vector2 = [number, number];

export interface Transform {
  pos: Vector3;
  rot: Vector3;
  scale: Vector3;
}

export interface NavAnchor {
  id: string;
  pos: Vector3;
  facing: Vector3;
}

export interface PoiDefinition {
  poi_id: PoiId;
  type:
    | "inbox"
    | "task_board"
    | "meeting_table"
    | "research_desk"
    | "dev_desk"
    | "delivery_shelf"
    | "lounge";
  nav_anchors: NavAnchor[];
  interaction_radius_m: number;
  capacity: number;
  highlight_nodes: string[];
  interaction: {
    type: "open_panel" | "focus_only" | "command";
    panel?: string;
    command?: string;
  };
}

export interface SceneObjectDefinition {
  id: string;
  url: string;
  transform: Transform;
  tags: string[];
  collider:
    | false
    | {
        type: "box" | "capsule" | "mesh";
        size?: Vector3;
        offset?: Vector3;
        radius?: number;
        height?: number;
      };
  interaction?: {
    type: "open_panel" | "focus_only" | "command";
    panel?: string;
    command?: string;
  };
  poi_id?: PoiId;
  interaction_radius_m?: number;
  highlight_nodes?: string[];
  instance_group?: string;
}

export interface SceneManifest {
  scene_id: string;
  version: number;
  office_shell: {
    url: string;
    transform: Transform;
    collision: {
      mode: "manifest" | "embedded";
    };
  };
  pois: PoiDefinition[];
  objects: SceneObjectDefinition[];
  navigation: {
    grid: {
      origin: Vector2;
      cell_size: number;
      width: number;
      height: number;
      walkable: string | number[];
    };
  };
  spawns?: {
    player: Vector3;
    agents: Record<string, Vector3>;
  };
  lighting_profile?: {
    mood?: "cozy_day" | "cozy_evening" | "focused_night" | "neutral";
    ambient_intensity?: number;
    key_intensity?: number;
    fill_intensity?: number;
    key_color?: string;
    fill_color?: string;
    fog_near_scale?: number;
    fog_far_scale?: number;
  };
  ambience_profile?: {
    motion_intensity?: number;
    cue_duration_ms?: number;
    cue_pulse_hz?: number;
  };
  fx_anchors?: Record<
    string,
    {
      id: string;
      pos: Vector3;
      kind?: string;
      radius_m?: number;
    }[]
  >;
  decor_anchors?: Record<
    string,
    {
      anchor_id: string;
      pos: Vector3;
      facing: Vector3;
    }[]
  >;
}
