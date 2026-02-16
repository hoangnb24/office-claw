# bd-2ewc: Offline focus linkage fix verification (KI-B01)

Date: 2026-02-15
Owner: HazyEagle

## Scope
Restore offline Event Feed linkage so deterministic event clicks drive scene focus state (`Focused POI`, `Focused agent`) instead of remaining `none`.

## Implementation
1. Prioritized business timeline events ahead of `snapshot_correction` noise in the Event Feed list.
2. Preserved fallback event->focus resolution so events without direct camera POI metadata still drive focused context.
3. Stabilized offline synthetic event cadence to keep early QA interaction window deterministic.

## Verification
Commands executed:

```bash
npm --prefix apps/client-web run typecheck
node tools/qa/check-offline-live-parity.mjs
# Offline deterministic browser pass
agent-browser open http://127.0.0.1:4180/
agent-browser eval "..."   # VQA-02/03/04 focus extraction
```

Result highlights (`reports/client-polish/qa/offline-parity-fixes/20260215T143555Z/scenario-checks.json`):
- `vqa02_focusedPoi_before`: `none`
- `vqa02_focusedPoi_after`: `poi_task_board`
- `vqa02_focusedAgent_before`: `none`
- `vqa02_focusedAgent_after`: `agent_design_1`
- `vqa04_focusedPoi_after`: `poi_task_board`
- `vqa04_focusedAgent_after`: `agent_research_1`

## Evidence
- Scenario checks: `reports/client-polish/qa/offline-parity-fixes/20260215T143555Z/scenario-checks.json`
- Command log: `reports/client-polish/qa/offline-parity-fixes/20260215T143555Z/command-log.txt`
- VQA-02 screenshot: `reports/client-polish/qa/offline-parity-fixes/20260215T143555Z/screenshots/VQA-02-camera-focus-panel-anchor.png`
- VQA-04 screenshot: `reports/client-polish/qa/offline-parity-fixes/20260215T143555Z/screenshots/VQA-04-event-feed-linkage.png`

## Verdict
`KI-B01` resolved in offline mode: event-feed clicks now set deterministic POI/agent focus instead of remaining unset.
