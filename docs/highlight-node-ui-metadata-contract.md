# Highlight-Node and UI Metadata Naming Contract (`bd-219`)

Last updated: 2026-02-15

## Purpose

Define stable naming and semantics for manifest fields that drive:
- POI highlighting
- interaction routing
- panel opening/focus behavior
- camera + overlay anchoring

Affordance-specific metadata policy (`label`, `tooltip`, `cursor`, and runtime fallback behavior) is documented in:
- `docs/manifest-ui-metadata-contract.md`

This contract is the source of truth for naming decisions touching:
- `assets/scenes/*.scene.json`
- `apps/client-web/src/scene/highlight/*.scene.json` (temporary mirrored snapshot)
- runtime consumers under `apps/client-web/src/scene/**`

## Contract Surface

The following scene-manifest fields are in scope:

1. `pois[].poi_id`
2. `pois[].highlight_nodes[]`
3. `pois[].interaction.{type,panel,command}`
4. `pois[].ui_anchor`
5. `pois[].camera_framing`
6. `objects[].id`
7. `objects[].poi_id`
8. `objects[].highlight_nodes[]`
9. `objects[].interaction.{type,panel,command}`

Schema references:
- `contracts/schemas/identifiers.schema.json`
- `contracts/schemas/scene-manifest.schema.json`

## Naming Rules

### 1) POI IDs

- Must match the canonical `poi_id` schema pattern:
  - `^poi_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`
- Must be unique in one manifest.
- Must remain stable across scene revisions (rename only with migration procedure below).

Examples:
- Valid: `poi_reception_inbox`, `poi_task_board`, `poi_delivery_shelf`
- Invalid: `POI_task_board`, `poi-task-board`, `poi_TaskBoard`

### 2) Object IDs

- Must be unique in one manifest.
- Recommended format for new IDs: lowercase snake_case.
- If an object is semantically attached to a POI, set `objects[].poi_id` to that POI.

Examples:
- Valid: `delivery_shelf`, `desk_01`
- Invalid: `DeliveryShelf`, `desk-01` (hyphen discouraged for consistency)

### 3) Highlight Node Names

- `highlight_nodes` entries are case-sensitive GLB node names.
- Names must match real nodes present in loaded asset(s).
- Recommended token format: `^[A-Za-z][A-Za-z0-9_]*$`.
- No duplicates within one `highlight_nodes` list.
- Prefer POI-level ownership of semantic highlight intent; object-level highlights may extend POI highlights.

Examples:
- Valid: `Head`, `LeftHand`, `RightHand`, `Spine`, `Hips`
- Invalid: `left hand`, `Head.Mesh`, `spine-01`

## UI Metadata Semantics

### 1) `interaction.type`

Allowed values (schema):
- `open_panel`
- `focus_only`
- `command`

Semantics:
- `open_panel`: focus target and optionally open UI panel derived from `interaction.panel`.
- `focus_only`: focus target, do not auto-open panel.
- `command`: runtime-specific command route; requires explicit consumer support.

### 2) `interaction.panel`

Canonical panel tokens for POI interactions:
- `inbox`
- `task_board`
- `deliverables`

Runtime panel mapping currently normalizes:
- `inbox` -> `inbox`
- `task_board` or `task-board` -> `task-board`
- `deliverables`, `artifact_viewer`, or `artifact-viewer` -> `artifact-viewer`

Preferred writing rule:
- Use canonical underscore tokens in manifest (`task_board`, `deliverables`) for consistency.

### 3) `ui_anchor`

Used for screen-space panel anchoring when POI is focused:
- `ui_anchor.pos`: world-space anchor point for overlay card projection
- `ui_anchor.facing`: optional directional hint
- `ui_anchor.size`: intended anchor footprint in world units

### 4) `camera_framing`

Used by focus-mode camera behavior:
- `camera_framing.kind`: semantic camera target type (`poi`, `agent`, `event`)
- `camera_framing.offset`: camera offset vector
- `camera_framing.zoom`: zoom multiplier applied during focus

## Consumer Alignment

Current runtime consumers:

1. `apps/client-web/src/scene/highlight/poiHighlightManifest.ts`
   - Builds POI highlight map from both `pois[].highlight_nodes` and POI-linked `objects[].highlight_nodes`.
2. `apps/client-web/src/scene/highlight/HighlightManager.ts`
   - Applies glow material overrides using resolved node names.
3. `apps/client-web/src/scene/focus/poiFocusManifest.ts`
   - Reads `ui_anchor` and `camera_framing` to drive panel anchor + camera focus defaults.
4. `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
   - Uses `interaction.panel` tokens to open the correct panel on arrival.
5. `apps/client-web/src/scene/loader/SceneLoader.ts`
   - Validates object-to-POI references and parses interaction/highlight metadata.

## Rename and Update Process

Any rename to `poi_id`, `objects[].id`, `highlight_nodes`, or interaction metadata is a contract change.

Required process:

1. Update canonical manifest:
   - `assets/scenes/cozy_office_v0.scene.json`
2. Update mirrored highlight manifest snapshot:
   - `apps/client-web/src/scene/highlight/cozy_office_v0.scene.json`
3. Validate schema and contract checks:
   - `node contracts/validation/run-validation.mjs`
4. Validate node-hook coverage:
   - `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.md`
5. Run client type/build checks:
   - `npm --prefix apps/client-web run typecheck`
   - `npm --prefix apps/client-web run build`
6. Include migration notes in PR/body:
   - old name(s)
   - new name(s)
   - files changed
   - validation commands and outcomes

Breaking-change policy:
- No silent renames.
- Rename must land atomically with manifest + consumer updates in the same change set.

## Examples

### POI entry example

```json
{
  "poi_id": "poi_task_board",
  "highlight_nodes": ["Spine", "RightHand"],
  "interaction": {
    "type": "open_panel",
    "panel": "task_board"
  },
  "ui_anchor": {
    "pos": [1.2, 1.1, 1.8],
    "facing": [0, 0, -1],
    "size": [1.4, 0.9]
  },
  "camera_framing": {
    "kind": "poi",
    "offset": [0, 1.2, 1.8],
    "zoom": 1.05
  }
}
```

### Object extension example

```json
{
  "id": "delivery_shelf",
  "poi_id": "poi_delivery_shelf",
  "interaction": {
    "type": "open_panel",
    "panel": "deliverables"
  },
  "highlight_nodes": ["Hips"]
}
```
