# CONTRIBUTOR_ONBOARDING.md

Last updated: 2026-02-16

## Purpose

This guide gets a contributor from zero context to productive delivery in OfficeClaw with concrete runtime, workflow, and validation steps.

## 1) Architecture Map Summary

### Runtime model

- Client (`apps/client-web`): React + Three.js (`@react-three/fiber`) scene rendering, user interaction, overlay surfaces, and offline mock runtime.
- World server (`apps/server-world`): authoritative `/ws/world` lifecycle, command routing, simulation ticks, snapshots, event timeline, replay/resync, and policy controls.
- Contracts (`contracts/`): canonical protocol/entity/scene schemas, positive and negative fixtures, and invariant validators.
- Tooling (`tools/`): QA gate runner, offline/live parity guard, asset/scene sync checks, GLB/nav preflight, and provenance ledger gates.

### Core design principle

- Server is authoritative for simulation and durable truth.
- Client is authoritative for rendering and interaction UX.

### Runtime source-of-truth files

- Server: `apps/server-world/src/worldServer.mjs`, `apps/server-world/src/commandRouter.mjs`, `apps/server-world/src/worldState.mjs`
- Client network/runtime: `apps/client-web/src/network/useWorldSocket.ts`, `apps/client-web/src/offline/mockWorldRuntime.ts`
- Contracts gate: `contracts/validation/run-validation.mjs`

## 2) Session Workflow

### A) Start of session

1. Read `AGENTS.md` and `README.md`.
2. Run `br ready --json` and `bv --robot-triage` to select ready work.
3. Set issue to in progress: `br update <br-id> --status in_progress`.
4. Reserve file scope in Agent Mail with `reason=<br-id>`.
5. Send an Agent Mail kickoff message using `thread_id=<br-id>` and subject prefix `[<br-id>]`.

### B) Implement and validate

1. Keep edits inside reserved file scope.
2. Run the smallest relevant validation set first.
3. Run full gates before completion when changing protocol/runtime/assets.

### C) Complete and close

1. Close work item: `br close <br-id> --reason "Completed"`.
2. Release file reservations.
3. Post completion summary in the same Agent Mail thread.
4. Sync beads state and commit `.beads/` changes:

```bash
br sync --flush-only
git add .beads/
git commit -m "sync beads"
```

## 3) Validation Command Matrix

Core workspace checks:

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
npm --prefix apps/server-world test
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
npm --prefix apps/client-web run assets:verify
```

QA suite:

```bash
node tools/qa/run-qa-gates.mjs
node tools/qa/run-qa-gates.mjs --only client
node tools/qa/run-qa-gates.mjs --only contracts
node tools/qa/run-qa-gates.mjs --only preflight
node tools/qa/run-qa-gates.mjs --only parity
```

Asset/runtime guards:

```bash
node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md
node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.md
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md
node tools/qa/check-offline-live-parity.mjs
```

## 4) Agent Mail and `br` Conventions

- Task status and dependencies are managed in `br`.
- Coordination, decisions, and audit attachments are managed in Agent Mail.
- Use a single ID everywhere for traceability:
  - `thread_id`: `<br-id>`
  - Mail subject prefix: `[<br-id>]`
  - File reservation reason: `<br-id>`

## 5) Common Failure Handling

### Reservation conflict

- Do not edit conflicting files.
- Select a different ready issue or coordinate split ownership in-thread.

### Validation failure

- Treat issue as incomplete.
- Post failing command and first actionable error line in-thread.
- Re-run until passing or explicit exception approval.

### Agent Mail degraded/timeout

- Continue on non-conflicting local scope.
- Retry mail operations at each milestone.
- Post catch-up summary when service recovers.

### Dirty worktree in multi-agent runs

- Never revert unrelated changes.
- Limit edits to your scoped files.
- Report exactly which files were modified.
