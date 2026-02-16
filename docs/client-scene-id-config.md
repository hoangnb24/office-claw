# Client Scene ID Config

Related bead: `bd-2jd`

The client startup scene id is now configurable through `VITE_SCENE_ID`.

## Runtime behavior

- `apps/client-web/src/config/runtimeProfile.ts` exposes `runtimeSceneId()`.
- Resolution logic:
  1. Use `VITE_SCENE_ID` when set to a non-empty value.
  2. Fallback to `cozy_office_v0` when unset/empty.
- `apps/client-web/src/App.tsx` now passes `runtimeSceneId()` into `useWorldSocket(...)`.

This removes hardcoded scene-id coupling from the startup call path and keeps backward compatibility with the existing default scene.

## Usage

```bash
VITE_SCENE_ID=cozy_office_v0 npm --prefix apps/client-web run dev
```

Example with offline baseline mode:

```bash
VITE_OFFLINE_MOCK_WORLD=1 \
VITE_WORLD_WS_AUTO_CONNECT=0 \
VITE_SCENE_ID=cozy_office_v0 \
npm --prefix apps/client-web run dev
```

## Verification

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```
