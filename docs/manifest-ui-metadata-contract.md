# Manifest UI Metadata Contract for Affordances (`bd-3l5u`)

Last updated: 2026-02-15

## Purpose

Define the manifest metadata contract that drives POI affordances:
1. tooltip copy
2. label copy
3. cursor behavior

This contract is additive to the naming/field surface in:
- `docs/highlight-node-ui-metadata-contract.md`

## Scope

This document covers optional affordance metadata under:
1. `pois[].ui`
2. `objects[].ui`

When both POI-level and object-level values exist for a POI-linked object:
1. object-level value wins for that object
2. POI-level value is fallback for linked objects

## Field Contract

Supported keys:
1. `label` (string)
2. `tooltip` (string)
3. `cursor` (`pointer` | `crosshair` | `help` | `default`)
4. `affordance` (`ring` | `pulse` | `none`)

Validation expectations:
1. strings must be non-empty after trim
2. unknown `cursor` values fall back to runtime default
3. unknown `affordance` values fall back to runtime default

## Runtime Fallback Behavior

If `ui` metadata is missing or malformed, runtime behavior is deterministic:
1. `label`
- fallback order: `poi.poi_id` -> object `id` -> `"Interact"`
2. `tooltip`
- fallback order: `ui.tooltip` -> resolved `label`
3. `cursor`
- if interaction exists (`interaction.type` present), fallback to `pointer`
- otherwise fallback to `default`
4. `affordance`
- if interaction exists, fallback to `ring`
- otherwise fallback to `none`

Malformed values do not block scene load. They are treated as non-fatal metadata issues.

## Authoring Examples

### POI-level affordance metadata

```json
{
  "poi_id": "poi_task_board",
  "interaction": {
    "type": "open_panel",
    "panel": "task_board"
  },
  "ui": {
    "label": "Task Board",
    "tooltip": "Review active and blocked tasks",
    "cursor": "pointer",
    "affordance": "ring"
  }
}
```

### Object-level override for linked POI

```json
{
  "id": "task_board_wall",
  "poi_id": "poi_task_board",
  "interaction": {
    "type": "open_panel",
    "panel": "task_board"
  },
  "ui": {
    "label": "Sprint Board",
    "tooltip": "Open board details",
    "cursor": "help",
    "affordance": "pulse"
  }
}
```

## Consumer Expectations

UI/interaction consumers should:
1. read `ui` metadata as advisory presentation data
2. keep routing semantics sourced from manifest interaction metadata (`interaction.*`)
3. apply the fallback rules above when fields are absent or invalid

Current client implementation status:
1. hover cursor affordance defaults to `pointer` for interactive targets (`poi`, `artifact`, `agent`)
2. hover tooltip and focused marker copy are derived from manifest metadata/fallback rules
3. malformed/missing `ui` values are non-fatal and resolved via deterministic fallback

## Change Management

When introducing new `ui` keys:
1. update this document first
2. add at least one concrete manifest example
3. define fallback behavior explicitly
4. update runtime consumers in the same change set or mark as `planned-only`
