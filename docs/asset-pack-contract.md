# v0 Asset Pack and Naming Contract (bd-2d8)

This contract defines the concrete `.glb` files shipped for the client-first slice and their intended runtime usage.

## File locations

All runtime assets for the web client live under:

- `apps/client-web/public/assets/**`

## Required files and usage mapping

| File | Runtime usage | Notes |
|---|---|---|
| `apps/client-web/public/assets/office_shell.glb` | office shell / room baseline | critical startup asset |
| `apps/client-web/public/assets/props/inbox.glb` | reception inbox prop | non-critical fallback enabled |
| `apps/client-web/public/assets/props/task_board.glb` | task board prop | non-critical fallback enabled |
| `apps/client-web/public/assets/props/delivery_shelf.glb` | delivery shelf prop | non-critical fallback enabled |
| `apps/client-web/public/assets/props/dev_desk.glb` | dev desk prop | non-critical fallback enabled |
| `apps/client-web/public/assets/props/blocker_cone.glb` | blocker marker prop | non-critical fallback enabled |
| `apps/client-web/public/assets/agents/agent_research.glb` | reference agent character asset | clip mapping documented below |

## Agent animation mapping notes

Reference agent asset:
- `apps/client-web/public/assets/agents/agent_research.glb`

Detected source clips:
- `Dance`, `Death`, `Idle`, `Jump`, `No`, `Punch`, `Running`, `Sitting`, `Standing`, `ThumbsUp`, `Walking`, `WalkJump`, `Wave`, `Yes`

Runtime contract clips expected:
- `Idle`
- `Walk`
- `Work_Typing`
- `Think`

Mapping for v0 until bespoke animation set is authored:
- `Idle` -> `Idle`
- `Walk` -> `Walking`
- `Work_Typing` -> `Sitting` (temporary stand-in)
- `Think` -> `Standing` (temporary stand-in)

## Validation evidence

GLB parse check (no hard load errors) executed with `GLTFLoader.parse` for all files above.

Observed result:
- all files parse successfully
- non-agent props currently carry no animation clips (expected)
- agent asset exposes clips listed above for mapping

## Runtime integration pointers

- Startup loading + fallback behavior: `apps/client-web/src/scene/assets/useSceneAssets.ts`
- Asset catalog path/source-of-truth: `apps/client-web/src/scene/assets/sceneAssetCatalog.ts`
- User-facing loading/error UX: `apps/client-web/src/overlay/OverlayRoot.tsx`
