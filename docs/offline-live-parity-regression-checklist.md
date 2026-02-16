# Offline-Live Parity Regression Checklist

Related bead: `bd-1b1i`

## Purpose

Guard against drift between offline mock and live gateway command behavior, and prevent dead-end microcopy regressions.

## Scripted Gate

Run:

```bash
node tools/qa/check-offline-live-parity.mjs
```

The script validates:
1. Golden command set is present in `CommandGateway` contract.
2. Dispatch modules route golden commands through `getCommandGateway().sendCommand(...)`.
3. Offline runtime switch handles the same golden command set.
4. Live gateway preserves shared `CommandGateway` semantics.
5. Error microcopy includes explicit recovery guidance and avoids dead-end wording.

## Manual Regression Checklist

1. Online mode (`VITE_OFFLINE_MOCK_WORLD=0`): submit one command from each golden family and confirm ack/error notices remain actionable.
2. Offline mode (`VITE_OFFLINE_MOCK_WORLD=1`): repeat the same command set and confirm outcomes are semantically equivalent (success path, deterministic validation errors).
3. Confirm no user-facing notice strands the user without a next action:
   - messages should include clear next steps (`retry`, `refresh`, `reconnect`, or equivalent).
4. If microcopy is changed in dispatch modules, re-run scripted parity gate before merge.

## User-Facing Signoff Extension (`bd-v0c9`)

When preparing polish freeze, parity checks should be paired with user-outcome criteria:

1. Discoverability
   - Core entry actions are obvious (`Inbox`, `Task Board`, `Artifact Viewer`).
   - First-run hints explain both manual and assisted task assignment paths.
2. Trust
   - Event-feed actions produce expected focus/inspector transitions in both modes.
   - Blocked/error messages include actionable next steps.
3. Flow Coherence
   - First-run path can progress across inbox -> task board -> deliverables -> decisions without dead ends.
   - Scenario-level parity evidence is available for `VQA-01..VQA-06`.

Record final pass/fail + risk disposition in:
- `reports/user-facing-success-checklist.bd-v0c9.md`

## Golden Command Set

- `submit_request`
- `assign_task`
- `auto_assign`
- `resolve_decision`
- `approve_artifact`
- `request_changes`
- `split_into_tasks`
