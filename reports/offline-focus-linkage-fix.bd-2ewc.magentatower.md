# Offline Focus Linkage Fix Support (`bd-2ewc`)

Generated at: `2026-02-15T14:18:00Z`  
Agent: `MagentaTower`

## Scope

Patch offline mock event generation so Event Feed clicks can reliably drive POI and agent focus in offline mode (`KI-B01` path).

## Root Cause

Offline-generated events often lacked explicit `poiId`/`agentId` fields.  
Event Feed click handling depends on this metadata for focus transitions (`VQA-02` / `VQA-04`), so offline runs could remain at `Focused POI: none` and `Focused agent: none`.

## Code Change

- Updated: `apps/client-web/src/offline/mockWorldRuntime.ts`
- Added deterministic offline focus metadata defaults:
  - `inferOfflinePoiForEvent(...)` maps key event types to stable POIs:
    - `kickoff_started` -> `poi_reception_inbox`
    - task/decision lifecycle events -> `poi_task_board`
    - artifact events -> `poi_delivery_shelf`
  - `firstNonBdParticipant(...)` fallback for `agentId` when missing.
  - `appendOfflineEvent(...)` now emits normalized `participants`, `agentId`, and `poiId`.
- Seeded initial offline events with explicit focus metadata so first-run Event Feed items are immediately focusable.

## Validation

### Build gates

- `npm --prefix apps/client-web run typecheck` ✅
- `npm --prefix apps/client-web run build` ✅

### Offline interaction verification (`agent-browser`)

Launch:
- `VITE_OFFLINE_MOCK_WORLD=1 VITE_WORLD_WS_AUTO_CONNECT=0 npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4180`

Browser flow:
1. `agent-browser --session bd2ewc-fix open http://127.0.0.1:4180/`
2. `agent-browser --session bd2ewc-fix press Alt+1`
3. Click first Event Feed item via `eval`.
4. Read debug HUD fields via `eval`.

Observed after click:
- `Focused POI: poi_task_board`
- `Focused agent: agent_research_1`

Evidence screenshot:
- `reports/client-polish/offline-vqa/20260215T135237Z/screenshots/VQA-KI-B01-after-fix.png`

## Notes

- This is a support artifact for active bead `bd-2ewc`; no bead status changes were made here.
