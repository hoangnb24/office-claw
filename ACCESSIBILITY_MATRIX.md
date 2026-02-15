# ACCESSIBILITY_MATRIX.md

Last updated: 2026-02-14
Related bead: `bd-29d`

## Scope
Define v0 accessibility requirements and a runnable test matrix for primary OfficeClaw interactions:
- `InboxPanel`
- `TaskBoardPanel`
- `AgentInspectorPanel`
- `ArtifactViewerPanel`
- `DecisionPanel`
- `ChatPanel` (BD-only)
- `EventFeedPanel`
- POI/world interactions (click-to-focus, walk-to-interact)

## Baseline Requirements

### Keyboard
- Every actionable control is reachable and operable with keyboard only.
- Interactive order follows visual reading order.
- No keyboard trap unless in a modal context, and modal trap must expose a clear `Close`.
- Panel-triggering actions available from world interactions must have UI equivalents.

### Focus
- Focus indicator is always visible and meets contrast requirements.
- Opening a panel moves focus to panel title or first meaningful control.
- Closing a panel returns focus to the control that opened it.
- Error summaries move focus to first unresolved field/action.

### Contrast
- Body text contrast: at least 4.5:1.
- Large text and persistent icon labels: at least 3:1.
- Focus ring and status indicators: at least 3:1 against adjacent colors.
- Do not rely on color alone for status (add icon/text labels for blocked, error, done).

### Motion and animation
- Respect system reduced-motion preference.
- Under reduced motion:
  - disable camera tweening and long easing animations
  - replace pulsing/glow loops with static state indicators
  - keep approval/transition feedback as instant state changes
- Motion must never block task completion or hide required controls.

### Input targets and readability
- Minimum pointer target: 24x24 CSS px for icon-only controls; 32x32 preferred.
- Line length and spacing should support scanning (especially in event feed and chat).
- Avoid timed auto-dismiss for critical decisions/errors.

## Surface Requirements

### InboxPanel
- Keyboard:
  - tab order: request list -> request form fields -> submit
  - `Enter` submits only when form is valid
- Focus:
  - after submit success, focus returns to request list heading
- Error handling:
  - invalid input shows inline error text and summary at top

### TaskBoardPanel
- Keyboard:
  - assignment action available without drag-and-drop (select task, select assignee, confirm)
  - drag interaction has a non-pointer fallback control path
- Focus:
  - focus remains stable when task columns update from server
- Status semantics:
  - To Do/Doing/Done are announced with text labels and not only color

### AgentInspectorPanel
- Keyboard:
  - inspector actions (`Focus camera`, `Ask BD`, decision open) are buttons/links
- Focus:
  - opening from world click moves focus to inspector heading
- State clarity:
  - current state (`Idle`, `Walking`, `Working`, `Blocked`) is exposed as plain text

### ArtifactViewerPanel
- Keyboard:
  - `Approve`, `Request changes`, `Split into tasks` reachable via tab order
- Focus:
  - on open, focus goes to artifact title; action buttons follow
- Error recovery:
  - failed action keeps the viewer open and focuses error summary + retry action

### DecisionPanel
- Keyboard:
  - all decision options are keyboard-selectable controls
- Focus:
  - opening a blocker prompt places focus on decision question
- Critical action safety:
  - irreversible decisions require explicit confirmation prompt

### ChatPanel
- Keyboard:
  - message input is reachable and send action supports keyboard
- Focus:
  - after send, focus returns to input for continued use
- Explainability safety:
  - responses remain concise and actionable; no hidden reasoning text

### EventFeedPanel
- Keyboard:
  - each event row is focusable and activatable without pointer
- Focus:
  - selecting an event and triggering world highlight keeps feed focus stable
- Readability:
  - timestamps and event titles remain readable at zoomed text sizes

### World interactions (POI click, walk-to-interact)
- Keyboard alternative:
  - each primary POI action can be opened from UI navigation controls
- Reduced motion:
  - camera focus transitions collapse to immediate jump under reduced motion
- Announcements:
  - when interaction requires walking first, UI exposes explicit state text (`Moving to Task Board...`)

## WCAG-Oriented Test Matrix

| ID | Area | Requirement | WCAG refs | Test method | Pass criteria |
|---|---|---|---|---|---|
| A11Y-001 | All panels | Keyboard-only operation | 2.1.1 | Manual keyboard walkthrough | All actions complete without mouse |
| A11Y-002 | All panels | Logical focus order | 2.4.3 | Manual tab sequence check | Focus order matches visual flow |
| A11Y-003 | All panels | Visible focus indicator | 2.4.7, 1.4.11 | Visual + contrast check | Focus state always visible and >=3:1 |
| A11Y-004 | Text and labels | Text contrast | 1.4.3 | Color contrast tooling | Body text >=4.5:1 |
| A11Y-005 | Status chips/icons | Non-text contrast | 1.4.11 | Color contrast tooling | UI indicators >=3:1 |
| A11Y-006 | Status communication | No color-only state | 1.4.1 | Visual inspection | Status includes text/icon cues |
| A11Y-007 | Motion | Reduced motion support | 2.2.2, 2.3.3 | OS reduced-motion simulation | Tween/pulse animations disabled |
| A11Y-008 | Task assignment | Non-drag fallback | 2.1.1 | Manual keyboard task assign | Task assignment possible without drag |
| A11Y-009 | Error handling | Focus to error summary | 3.3.1, 3.3.3 | Invalid input scenario | Focus lands on actionable error |
| A11Y-010 | Decision flows | Critical choice confirmation | 3.3.4 | Manual decision scenario | Confirmation required for destructive choice |
| A11Y-011 | Dynamic updates | Stable focus during snapshot refresh | 3.2.1 | Live update simulation | Focus is not unexpectedly moved |
| A11Y-012 | Event feed | Focusable event rows | 2.1.1, 2.4.7 | Keyboard event selection | Event highlight works from keyboard |

## QA Execution Script (Manual + Automation Hooks)

### Manual run order
1. Load app with default motion settings; execute A11Y-001 through A11Y-006.
2. Enable reduced motion at OS level; execute A11Y-007 and key journey spot checks.
3. Run assignment, decision, and artifact error scenarios for A11Y-008 through A11Y-012.

### Automation hooks
- Add axe checks for each panel route/state.
- Add keyboard e2e tests for:
  - open panel -> perform action -> close panel -> focus return
  - assign task without drag-and-drop
  - submit decision and validate confirmation path
- Add reduced-motion snapshot tests for camera/pulse behavior toggles.

## Known Exceptions (v0)
- Full screen-reader narration for 3D scene objects is out of v0 scope.
- Accessibility for freeform 3D navigation is limited; required interactions must remain available via panel controls.
- Any exception must include: rationale, impacted flow, mitigation, and follow-up bead.

## Handoff Checklist
- Requirements cover all core panels and POI-linked interactions.
- WCAG-oriented matrix is concrete enough for QA to execute without interpretation drift.
- Reduced-motion, keyboard fallback, and focus recovery rules are explicit.
- Exceptions are documented with mitigation and follow-up path.
