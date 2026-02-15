# Visual QA Checklist and Scripts

This document defines deterministic manual QA scripts for hitboxes, camera, highlights, and linked overlay flows.

Companion launcher:
- `tools/qa/run-visual-qa.sh`

## Preflight

1. Optional static validation:
   - `npm --prefix apps/client-web run typecheck`
   - `npm --prefix apps/client-web run build`
2. Start target runtime:
   - Online: server + client
   - Offline: `VITE_WORLD_WS_AUTO_CONNECT=0 npm --prefix apps/client-web run dev`
3. Reset browser state (new tab/private window) before each run.

## Deterministic Scenario Scripts

### VQA-01 Hitbox Target Resolution

1. Hover each interactive POI (inbox/task board/delivery shelf) and at least one agent.
2. Click each target once.
3. Confirm expected panel/action routing:
   - POI opens matching panel or starts walk-to-interact flow.
   - Agent opens Agent Inspector.

Expected:
- no ambiguous hover target flicker
- no clicks routed to wrong POI/agent
- no console exceptions during target selection

### VQA-02 Camera Focus + Anchored Panel Placement

1. Trigger POI focus through click-to-interact and Event Feed item click.
2. Confirm camera framing animates to focus target and anchored panel appears near POI.
3. Exit focus via `Escape` and `Clear Focus`.

Expected:
- camera framing transitions are smooth and reversible
- anchored panel tracks focused POI and does not persist after focus clear

### VQA-03 Highlight Lifecycle

1. Focus POI A, then POI B, then clear focus.
2. Select and hover an agent during POI focus transitions.
3. Verify glow/highlight clears and reapplies deterministically.

Expected:
- previous highlights are removed when focus changes
- no stale glow markers remain after clearing focus

### VQA-04 Event Feed Linkage

1. Open Event Feed and click recent semantic events with `poi_id` and `agent_id`.
2. Validate linked behavior:
   - POI event sets focused POI and opens related panel.
   - Agent event opens Agent Inspector and focuses agent context.

Expected:
- event-driven focus transitions are immediate and deterministic
- no-op behavior only when event payload lacks focusable identifiers

### VQA-05 Navigation + Debug Overlay Diagnostics

1. Enable Debug HUD and toggle:
   - path nodes
   - blocked cells
   - anchor issue overlay
2. Issue click-to-move and walk-to-interact actions.
3. Toggle overlays off and repeat one move interaction.

Expected:
- overlays appear/disappear strictly per toggle state
- nav debug counters update (`pathNodeCount`, status/reason) without runtime errors

### VQA-06 Agent Inspector Live State/Task/Blockers

1. Click an agent to open Agent Inspector.
2. Check rendered fields:
   - role/state/position/task
   - blocker and needs hints
3. Use quick actions:
   - focus agent
   - open task board / event feed / inbox

Expected:
- inspector fields update as snapshots/events change
- blocker/needs presentation is consistent with task state and latest decision event data

## Known-Failure Catalog (Fast Triage)

| ID | Symptom | Likely Cause | First Checks |
|---|---|---|---|
| VF-001 | Click selects wrong object/none | Raycast metadata mismatch | `interactionTarget` metadata in scene nodes, InteractionManager hit filtering |
| VF-002 | Focus panel anchored off-screen | POI anchor projection mismatch | focus anchor values, camera framing offsets, projected screen anchor updates |
| VF-003 | Highlight remains after focus clear | highlight reset lifecycle skipped | focus clear path (`Escape`/button), highlight manager clear call sequence |
| VF-004 | Event click does not focus | missing `poi_id`/`agent_id` payload | inspect event payload in Event Feed and socket envelope parsing |
| VF-005 | Path overlay not rendering | HUD toggle off or debug profile disabled | Debug HUD enabled + overlay toggles, `VITE_NAV_DEBUG`/`VITE_DEBUG_HUD` profile |
| VF-006 | Inspector blocker unknown while blocked | missing decision event context | related event stream contains `decision_id`, task status from snapshot |

## Run Report Template

Use this template per run:

```md
Date/Build:
Mode: online|offline
Scenarios:
- VQA-01: pass|fail (notes)
- VQA-02: pass|fail (notes)
- VQA-03: pass|fail (notes)
- VQA-04: pass|fail (notes)
- VQA-05: pass|fail (notes)
- VQA-06: pass|fail (notes)

Known-failure IDs observed:
Follow-up beads/issues:
```
