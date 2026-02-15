# Client Panel State Standards

Related bead: `bd-17v`

## Overview

Standardized loading, empty, and error state surfaces were applied across primary overlay panels and aligned with `CONTENT_GUIDELINES.md`.

## Shared Pattern Implementation

- `apps/client-web/src/overlay/OverlayRoot.tsx`
  - Added shared `PanelStateMessage` renderer with deterministic variants:
    - `loading`
    - `empty`
    - `error`
  - Centralized connection-derived state gates:
    - `isConnectionLoading`
    - `hasConnectionIssue`
  - Applied to Event Feed, Inbox, Task Board, Artifact Viewer, Decision Panel, and Agent Inspector.
- `apps/client-web/src/state/uiStore.ts`
  - Introduced `PanelNoticeLevel` as shared notice-level type across inbox/task/decision/artifact notice state.

## Panel-State Mapping

- Event Feed
  - loading: timeline syncing
  - empty: no events yet with CTA to Inbox
  - error: stream disconnected with recovery CTA
- Inbox
  - loading: request history syncing
  - error: server connection failure with Event Feed fallback
- Task Board
  - loading: assignment/task snapshot syncing
  - empty: no tasks yet with CTA to Inbox
  - error: board unavailable with Event Feed fallback
- Artifact Viewer
  - loading: deliverable/version data syncing
  - empty: no deliverables with CTA to Task Board
  - error: artifact stream unavailable with Event Feed fallback
- Decision Panel
  - loading: decision context syncing
  - empty: no open decisions with CTA to Task Board
  - error: snapshot unavailable with Task Board fallback
- Agent Inspector
  - loading: agent details syncing
  - empty: no selected/available agent with CTA to Task Board
  - error: agent state unavailable with Event Feed fallback

## Deterministic Error-Code UX Mapping

- `apps/client-web/src/network/inboxCommands.ts`
- `apps/client-web/src/network/taskBoardCommands.ts`
- `apps/client-web/src/network/decisionCommands.ts`
- `apps/client-web/src/network/artifactCommands.ts`

Each command surface now maps `VALIDATION_FAILED | NOT_FOUND | CONFLICT | RATE_LIMITED | NOT_ALLOWED | INTERNAL` to deterministic, user-safe copy with explicit recovery action phrasing (`Reason: ... Next: ...`).

## Validation

- `npm --prefix apps/client-web run typecheck`
- `npm --prefix apps/client-web run build`
