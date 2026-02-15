# Client-Only Vertical Slice Validation (bd-2ii)

Date: `2026-02-14`  
Scope: offline-only flow (`VITE_OFFLINE_MOCK_WORLD=1`) across M0-M2 interaction loop.

## Scripted Validation Run

```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run typecheck
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run build
```

Result:
- `typecheck` passed
- `build` passed (bundle-size warning only)

## Evidence Mapping for Offline Loop

- Offline runtime activation:
  - `apps/client-web/src/network/useWorldSocket.ts`
  - `apps/client-web/src/offline/mockWorldRuntime.ts`
- Render + scene boot path:
  - `apps/client-web/src/App.tsx`
  - `apps/client-web/src/scene/OfficeScene.tsx`
- Click + interaction intent routing:
  - `apps/client-web/src/scene/interaction/useInteractionManager.ts`
  - `apps/client-web/src/state/interactionStore.ts`
- Movement + walk-to-interact gating:
  - `apps/client-web/src/scene/nav/LocalNavigationLayer.tsx`
  - `apps/client-web/src/state/playerStore.ts`

## Manual Demo Script (Repeatable)

1. Start client in offline mode:
```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run dev
```
2. Open the local Vite URL and verify runtime profile:
  - `data-runtime-profile="offline-mock"` present on `.app-shell`.
  - World appears connected without requiring `/ws/world`.
3. Validate render + interaction core:
  - hover/select POIs and agents (M1 interaction path).
  - click floor to trigger movement intent and path traversal.
  - click POI out of range and verify walk-to-interact behavior (move first, then panel open on arrival).
4. Validate offline simulation feel:
  - task board/event feed shows seeded deterministic activity.
  - agents continue deterministic goal/path movement over time.
5. Validate repeatability:
  - reload page and confirm same seeded startup snapshot (agents/tasks/events) before tick updates.

## Bug/Risk Log

| Severity | Risk | Evidence | Follow-up |
|---|---|---|---|
| Medium | No automated browser-level assertion for click/move/walk-to-interact yet | Current proof is scripted + manual, not e2e replay | `bd-2cx` |
| Medium | Accessibility/readability polish for interaction-heavy panels remains pending | M1 gate documented remaining a11y hardening | `bd-94r` |
| Low | Camera-follow and interaction UX polish gaps may affect demo quality | M2 gate notes camera/polish follow-up | `bd-e7n`, `bd-zax` |
| Low | Large production bundle warning can impact slower devices | Vite build emits >500kB warning | `bd-2k5` |

## Demo Checklist (New Contributor)

- Set `VITE_OFFLINE_MOCK_WORLD=1`.
- Run `npm --prefix apps/client-web run dev`.
- Confirm scene loads and overlay renders without backend.
- Click-to-move works across floor.
- Walk-to-interact opens POI panel only after arrival radius.
- Agent/task/event surfaces show active deterministic updates.
- Run `typecheck` and `build` with offline flag and confirm pass.
