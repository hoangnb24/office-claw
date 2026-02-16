# OfficeScene Provider Runtime Migration (bd-xqw)

Generated: 2026-02-15T13:07:35Z

## Objective

Migrate `OfficeScene` primary rendering path from catalog-driven assets to `SceneRuntimeProvider` runtime data so shell/object composition and interaction wiring come from manifest runtime output.

## Changes

### 1) Provider runtime is now primary render source

Updated `apps/client-web/src/scene/OfficeScene.tsx` to consume:
- `useSceneRuntimeProvider().snapshot.runtimeData`
- `useSceneRuntimeProvider().snapshot.derived.poiHighlightNodesById`

Rendering now uses:
- `runtimeData.shell.root` for office shell
- `runtimeData.objects[]` for scene objects

### 2) Interaction targets derive from manifest object metadata

Removed asset-id/canonical-manifest matching logic from `OfficeScene`.

Interaction target assembly now uses runtime object metadata:
- `poi_id`
- `interaction.panel` / `interaction.type`
- `highlight_nodes`

Panel command mapping remains deterministic:
- `inbox -> open_inbox_panel`
- `task_board -> open_task_board_panel`
- `deliverables -> open_deliverables_panel`

### 3) Explicit fallback path retained (non-primary)

When a manifest object fails runtime asset load, `OfficeScene` now renders fallback geometry from that object spec:
- position from `object.transform.pos`
- size from `object.collider.size` (for box colliders) or default `[0.8,0.8,0.8]`
- panel-aware fallback color

This keeps degraded runtime behavior explicit without reverting to catalog-first composition.

### 4) Agent render compatibility

Updated agent GLB URLs in `OfficeScene` to match synced runtime asset paths:
- `/assets/agent1_skeleton.glb`
- `/assets/agent1_animations.glb`

## Acceptance Mapping

1. OfficeScene renders shell and objects from provider data: ✅
2. Legacy catalog path is removed or clearly non-primary: ✅ (runtimeData is primary; fallback only for missing loaded objects)
3. Interaction targets derive from runtime data: ✅

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix contracts run validate
```

Results:
- typecheck: pass
- build: pass
- contracts validate: pass
