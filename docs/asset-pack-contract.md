# v0 Asset Pack and Naming Contract (bd-2d8)

This contract defines the concrete `.glb` files shipped for the client-first slice and their intended runtime usage.

## File locations

All runtime assets for the web client live under:

- `apps/client-web/public/assets/**`

## Required files and usage mapping

| File | Runtime usage | Notes |
|---|---|---|
| `apps/client-web/public/assets/office_shell.glb` | office shell / room baseline | critical startup asset |
| `apps/client-web/public/assets/inbox.glb` | reception inbox prop | non-critical fallback enabled |
| `apps/client-web/public/assets/task_board.glb` | task board prop | non-critical fallback enabled |
| `apps/client-web/public/assets/shelf.glb` | delivery shelf prop | non-critical fallback enabled |
| `apps/client-web/public/assets/desk.glb` | dev desk prop | non-critical fallback enabled |
| `apps/client-web/public/assets/blocker_cone.glb` | blocker marker prop | non-critical fallback enabled |
| `apps/client-web/public/assets/agent1_skeleton.glb` | runtime agent skeleton | canonical runtime mesh asset |
| `apps/client-web/public/assets/agent1_animations.glb` | runtime agent animation bundle | canonical runtime clip source |

## Agent animation mapping notes

Canonical runtime agent assets:
- `apps/client-web/public/assets/agent1_skeleton.glb`
- `apps/client-web/public/assets/agent1_animations.glb`

Runtime contract clips expected:
- `Idle`
- `Walk`
- `Work_Typing`
- `Think`

Legacy note:
- Historical docs and experiments referenced `/assets/agents/*` and `/assets/props/*` URL groups.
- Canonical runtime URLs are now rooted at `/assets/<file>.glb`.
- Keep legacy paths only as historical context in archived reports; do not add them to new manifests.

## Validation evidence

GLB parse check (no hard load errors) executed with `GLTFLoader.parse` for all files above.

Observed result:
- all files parse successfully
- non-agent props currently carry no animation clips (expected)
- runtime animation contract is validated against `agent1_animations.glb`

## Runtime integration pointers

- Scene manifest source-of-truth: `assets/scenes/cozy_office_v0.scene.json`
- Runtime URL contract enforcement: `apps/client-web/src/scene/loader/SceneLoader.ts`
- Legacy startup catalog (historical): `apps/client-web/src/scene/assets/sceneAssetCatalog.ts`
- User-facing loading/error UX: `apps/client-web/src/overlay/OverlayRoot.tsx`
