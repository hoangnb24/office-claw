# AGENTS.md (apps/client-web)

Scope: `apps/client-web/**`

## Start Here

- Runtime entry: `apps/client-web/src/App.tsx`
- Network mode switch: `apps/client-web/src/config/runtimeProfile.ts`
- Socket/offline runtime bridge: `apps/client-web/src/network/useWorldSocket.ts`
- Overlay root/UI flow: `apps/client-web/src/overlay/OverlayRoot.tsx`

## Common Task Entry Points

- Command dispatch contracts: `apps/client-web/src/network/commandGateway.ts`
- Offline behavior parity: `apps/client-web/src/offline/mockWorldRuntime.ts`
- Scene runtime assembly: `apps/client-web/src/scene/runtime/SceneRuntimeProvider.ts`
- Navigation interactions: `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`

## Commands

```bash
npm --prefix apps/client-web run dev
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix apps/client-web run assets:sync
npm --prefix apps/client-web run assets:verify
```

## Runtime Profiles

- Offline mock mode: `VITE_OFFLINE_MOCK_WORLD=1`
- Disable websocket auto-connect: `VITE_WORLD_WS_AUTO_CONNECT=0`
- Live world websocket URL: `VITE_WORLD_WS_URL=ws://127.0.0.1:8787/ws/world`

## Required Validation

- For network/command changes: `node tools/qa/check-offline-live-parity.mjs`
- For asset/scene changes: `npm --prefix apps/client-web run assets:verify`
