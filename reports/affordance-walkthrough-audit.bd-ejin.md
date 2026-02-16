# First-Time Affordance Walkthrough Audit (`bd-ejin`)

Run ID: `20260215T131640Z`  
Capture tool: `agent-browser`  
Primary runtime target used for walkthrough: `http://127.0.0.1:4173/`

## Walkthrough Script

1. Open landing view and read first-run guidance.
2. Open Inbox panel and submit a first request.
3. Observe Task Board/Event Feed updates.
4. Open Artifact Viewer and Decisions panel.
5. Run guided onboarding flow Step 1 -> Step 4 and inspect instruction clarity.

## Evidence Screenshots

- `reports/client-polish/affordance-audit/20260215T131640Z/01-landing.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/02-inbox-panel.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/03-request-submitted.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/04-artifact-viewer.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/05-decisions-panel.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/06-guided-flow-step1.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/07-guided-flow-step2.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/08-guided-flow-step3.png`
- `reports/client-polish/affordance-audit/20260215T131640Z/09-guided-flow-step4.png`

## Confusion Points (Severity Ranked)

| ID | Severity | Observation | Screenshot Context |
| --- | --- | --- | --- |
| `CP-01` | High | Debug HUD + nav debug overlays are visible by default during first-run flow and dominate attention with critical perf alerts. This competes with onboarding guidance and can make users think runtime is broken before trying core actions. | `01-landing.png`, `06-guided-flow-step1.png`, `09-guided-flow-step4.png` |
| `CP-02` | Medium | Inbox notice remains at "Request submitted. Waiting for server acknowledgment." even after downstream events/tasks appear. Perceived state can look stuck or contradictory. | `03-request-submitted.png` |
| `CP-03` | Medium | Guided Step 2 says users can "drag tasks between specialists," but drag affordance is not explicit/discoverable in panel UI. New users may interpret this as missing/broken behavior. | `07-guided-flow-step2.png` |
| `CP-04` | Medium | Guided Step 4 instructs "Resolve blockers from the Decisions panel" while panel frequently shows `Open (0)`. Narrative timing mismatch weakens trust in guided flow. | `05-decisions-panel.png`, `09-guided-flow-step4.png` |
| `CP-05` | Low | Runtime status line `Startup assets: 0/0 loaded=0 failed=0` appears in connected flow and can read as ambiguous/no-op load state to first-time users. | `01-landing.png` |

## Proposed Adjustments and Tracking

1. Reduce default debug noise in first-run/demo profile while keeping engineer toggles available.
   - Tracked: `bd-derz`
2. Align request and decision microcopy with actual runtime state transitions.
   - Tracked: `bd-m9rj` (new)
3. Align Task Board guided instruction with discoverable drag/reassign affordances.
   - Tracked: `bd-24w1` (new)
4. Improve scene/runtime status messaging clarity in overlay loading/issue surface.
   - Tracked: `bd-w2z` (in progress)

## Outcome

`bd-ejin` acceptance criteria are satisfied:

1. Walkthrough covered critical POIs/action loops (Inbox, Task Board, Artifact Viewer, Decisions, Guided Flow).
2. Confusion points are severity-ranked with screenshot evidence.
3. Affordance adjustments are proposed and tracked by bead IDs.
