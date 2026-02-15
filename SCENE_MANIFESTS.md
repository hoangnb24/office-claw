# SCENE_MANIFESTS.md — Scene & Interaction Manifests for `.glb` Worlds
_Last updated: 2026-02-14

This document defines how your Three.js client loads a scene (office shell + props + POIs) and makes objects:
- **visible** (loaded + placed)
- **collidable** (blocks movement)
- **interactive** (clickable → opens UI panel / triggers command)
- **highlightable** (event feed can glow a room/object)

> You will author `.glb` manually. These manifests are the runtime “glue” connecting assets to gameplay.

---

## 1) Why a manifest?
A `.glb` alone does not tell the engine:
- which meshes are clickable vs decorative
- what a click should do
- where agents should stand to “use” a desk
- where collision boundaries exist
- what to highlight when an event references a POI

A **scene manifest** provides that mapping without forcing complex DCC workflows.

---

## 2) Files and locations (recommended)
- `assets/scenes/<scene_id>.scene.json` — the main scene manifest
- `assets/scenes/<scene_id>.nav.json` — optional separate nav grid file (if large)
- `assets/scenes/<scene_id>.README.md` — human notes / diagram links
- Example valid manifest in-repo: `assets/scenes/cozy_office_v0.scene.json`

---

## 3) Coordinate system and scale (required conventions)
- World is 3D: XZ plane is floor, Y is up.
- Scale: **1 unit = 1 meter**.
- Rotations are radians in `[x,y,z]` order (or specify if you use degrees; pick one).
- Canonical ID naming and regex contracts come from `DOMAIN_MODEL.md` and `contracts/schemas/identifiers.schema.json`.

---

## 4) Scene manifest schema (v0)

Validation contract implementation: `contracts/schemas/scene-manifest.schema.json`.

### 4.1 Top-level structure
```json
{
  "scene_id": "cozy_office_v0",
  "version": 1,
  "office_shell": {
    "url": "/cdn/office_shell.glb",
    "transform": {"pos":[0,0,0], "rot":[0,0,0], "scale":[1,1,1]},
    "collision": {"mode":"manifest"}
  },
  "pois": [],
  "objects": [],
  "navigation": {}
}
```

### 4.2 POIs (Points of Interest)
POIs are semantic anchors for:
- agent goals
- event feed highlights
- user interactions (Inbox, Task Board, Meeting Table)

```json
{
  "poi_id": "poi_task_board",
  "type": "task_board",
  "nav_anchors": [
    {"id":"stand", "pos":[1.2,0,2.0], "facing":[0,0,-1]}
  ],
  "interaction_radius_m": 1.25,
  "ui_anchor": {"pos":[1.2, 1.1, 1.8], "facing":[0,0,-1], "size":[1.4,0.9]},
  "camera_framing": {"kind":"poi", "offset":[0.0, 1.2, 1.8], "zoom": 1.05},
  "capacity": 2,
  "highlight_nodes": ["TaskBoardWall", "StickyBoardFrame"],
  "interaction": {
    "type": "open_panel",
    "panel": "task_board"
  }
}
```

**Fields**
- `poi_id` (string, unique, must match `^poi_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`)
- `type` (enum-like string): inbox | task_board | meeting_table | research_desk | dev_desk | delivery_shelf | lounge
- `nav_anchors[]`: where an agent stands to use the POI (multiple seats allowed)
- `interaction_radius_m` (number, optional): how close the player must be for the POI interaction to trigger (enables “walk-to-interact”)
- `ui_anchor` (object, optional): where/how the UI should visually anchor near this POI (used by POI Focus Mode)
- `camera_framing` (object, optional): suggested camera offset/zoom when focusing this POI
- `capacity`: number of agents that can occupy anchors concurrently
- `highlight_nodes[]`: mesh node names in the `.glb` to glow/outline
- `interaction`: what happens when user clicks the POI

### 4.3 Objects (props, interactables, colliders)
```json
{
  "id": "delivery_shelf",
  "url": "/cdn/props/shelf.glb",
  "transform": {"pos":[-1.0,0,2.2], "rot":[0,0,0], "scale":[1,1,1]},
  "tags": ["prop", "interactive"],
  "collider": {"type":"box", "size":[1.2,1.8,0.4], "offset":[0,0.9,0]},
  "interaction": {"type":"open_panel", "panel":"deliverables"},
  "poi_id": "poi_delivery_shelf",
  "interaction_radius_m": 1.25,
  "highlight_nodes": ["ShelfFrame"]
}
```

**Collider types**
- `box` (recommended v0)
- `capsule` (characters)
- `mesh` (avoid v0; expensive and finicky)

### 4.4 Navigation (grid-first)
For cozy offices, a simple grid is best.

```json
{
  "navigation": {
    "grid": {
      "origin": [-4, -4],
      "cell_size": 0.25,
      "width": 32,
      "height": 32,
      "walkable": "RLE_or_base64_encoded"
    }
  }
}
```

**Encoding**
- v0 can store walkability as an array of 0/1 integers.
- For production, prefer RLE or base64 for compactness.

---

## 5) Interaction strategy: object hits vs POI hits

### Pattern A (recommended): Interactable objects reference POIs
- Clicking `delivery_shelf` opens deliverables panel
- That object has `poi_id = poi_delivery_shelf`
- Events reference POIs, not raw mesh ids

**Pros:** stable semantics even if art changes mesh names.

### Pattern B: Interactions directly on objects
- Clicking a specific mesh name triggers the action
- No POI abstraction

**Pros:** simpler for tiny scenes.  
**Cons:** breaks when you remodel assets.

Start with **Pattern A**.

---

## 6) Highlighting rules (event feed → world)
When user clicks an event, client should:
1. Find referenced `poi_id` and/or `participants`
2. Glow/outline all meshes in `poi.highlight_nodes`
3. Glow agent meshes for participant ids
4. Optional: camera pan to POI anchor

**Implementation note**
- v0 highlight can be a material emissive swap (cheap).
- Outline pass is nicer but adds complexity.

---

## 7) Instancing and batching hints (performance)
Manifests can include optional hints:

```json
{
  "id": "plant_01",
  "url": "/cdn/props/plant.glb",
  "transform": {"pos":[0.2,0,1.1], "rot":[0,0,0], "scale":[1,1,1]},
  "instance_group": "plant_small",
  "collider": false
}
```

Client can group all items with the same `instance_group` into an `InstancedMesh`.

---

## 8) Spawn points
Include explicit spawn points so onboarding and resets are deterministic:

```json
{
  "spawns": {
    "player": [0.0,0,0.0],
    "agents": {
      "agent_bd": [0.6,0,0.2],
      "agent_research_1": [0.8,0,0.4],
      "agent_eng_1": [1.0,0,0.4]
    }
  }
}
```

## 8.5 Decor anchors (trophies / progression)
To support persistent “office trophies” without a building editor, define fixed anchor points the server can target.

```json
{
  "decor_anchors": {
    "trophy_shelf": [
      {"anchor_id":"trophy_shelf_01","pos":[-2.2, 0.9, 1.6], "facing":[1,0,0]},
      {"anchor_id":"trophy_shelf_02","pos":[-2.2, 0.9, 1.2], "facing":[1,0,0]}
    ]
  }
}
```

The world server can then persist placements in snapshot state (e.g., `office_decor[]`) without changing the room layout.

---

## 9) Authoring checklist (asset + manifest)
**Before shipping a scene**
- All POIs have nav anchors and highlight nodes
- All interactive POIs/objects have sensible `interaction_radius_m` values (or rely on defaults)
- All interactables have `interaction` definitions
- Collision is present for walls and large props
- Grid walkability matches collisions (no unreachable anchors)
- Spawn points are on walkable tiles
- Mesh node names referenced by `highlight_nodes` exist in `.glb`

---
