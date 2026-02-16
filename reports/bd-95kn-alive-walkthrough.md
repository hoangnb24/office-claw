# bd-95kn Sprint A Alive-Scene Walkthrough

Generated: 2026-02-16T01:59:12Z

## Run context

- Scene: `cozy_office_v0`
- Mode: offline mock (`VITE_OFFLINE_MOCK_WORLD=1`, `VITE_WORLD_WS_AUTO_CONNECT=0`)
- Capture root: `reports/client-polish/sprint-a-walkthrough/20260216T015711Z`
- Capture method: `agent-browser` session automation

## Acceptance coverage

### 1) Screenshot set covers Sprint A P0 zones

Coverage mapping:

1. Office shell / global scene context:
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/01-overview.png`
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/07-scene-overview-viewport.png`
2. Inbox zone (`poi_reception_inbox`):
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/02-inbox-panel.png`
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/08-inbox-focus-viewport.png`
3. Task board zone (`poi_task_board`):
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/03-task-board-panel.png`
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/09-task-board-focus-viewport.png`
4. Delivery shelf / blocker-cone zone (`poi_delivery_shelf` + cone markers):
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/04-artifact-panel.png`
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/10-latest-event-focus-viewport.png`
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/13-scene-delivery-focus-no-ui.png`
5. Dev desk zone:
   - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/14-scene-desk-focus-no-ui.png`

### 2) Explicit Agent1 desk-sit/work evidence

- `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/11-agent-inspector-viewport.png`
  - Agent Inspector shows `Agent: agent_bd` with `State: Working`
  - Position shows desk-area coordinates (near desk anchor path endpoint)
- Supporting scene shot:
  - `reports/client-polish/sprint-a-walkthrough/20260216T015711Z/screenshots/14-scene-desk-focus-no-ui.png`

### 3) Interaction evidence (inbox/task-board/delivery/cone)

1. Inbox interaction/panel evidence:
   - `02-inbox-panel.png`, `08-inbox-focus-viewport.png`
2. Task board interaction/panel evidence:
   - `03-task-board-panel.png`, `09-task-board-focus-viewport.png`
3. Delivery interaction/panel evidence:
   - `04-artifact-panel.png`, `10-latest-event-focus-viewport.png`
4. Blocker cone state communication evidence:
   - `13-scene-delivery-focus-no-ui.png`
   - `14-scene-desk-focus-no-ui.png`
   - (cone beacon/readability behavior implemented in `OfficeScene.tsx` and exercised during blocked-task state)

## Runtime sanity notes

- Snapshot evidence (`snapshot-overview.txt`) captured:
  - `Startup assets: 8/8 loaded=8 failed=0`
  - `Scene runtime issues: 0`
- Browser errors file:
  - `browser-errors.txt` is empty (no page errors captured)
- Console warnings:
  - non-blocking React Router future-flag notices
  - WebGL ReadPixels performance warnings during capture

## Residual issues and recommended next action

| ID | Severity | Issue | Recommended next action |
|---|---|---|---|
| KI-R01 | medium | Scene readability remains dark in capture-heavy focused views, making some props harder to visually parse in static screenshots. | Run a dedicated lighting/readability polish pass (tone/exposure + key/fill rebalance) and refresh screenshot baselines. |
| KI-R02 | medium | Runtime perf remains in critical band during capture sessions (low FPS / high frame p95 from debug HUD). | Run targeted perf follow-up (draw-call/triangle budget and overlay impact profiling) before broader visual signoff. |
| KI-R03 | low | Capture automation via `agent-browser` is reliable but panel-heavy by default; scene-only framing required extra steps. | Add a repo-owned QA capture script variant that toggles panel visibility and captures scene-focused crops deterministically. |

## Disposition

`bd-95kn` evidence packet assembled with screenshot coverage, desk-work proof, interaction proof, and explicit residual-risk ledger for follow-on prioritization.
