# CONTRIBUTOR_ONBOARDING.md

Last updated: 2026-02-14
Related bead: `bd-bwf`

## Purpose
This guide gets a contributor from zero context to productive delivery in OfficeClaw, with concrete workflow steps for architecture understanding, bead execution, and Agent Mail coordination.

## 1) Architecture Map Summary

### Runtime model
- **Client (`apps/client-web`)**: React + Three.js (`@react-three/fiber`) renders the office world, accepts user input, and shows overlay panels.
- **World Server (planned/partial in specs)**: authoritative state, simulation ticks, event emission, and command handling.
- **Contracts (`contracts/`)**: canonical types + JSON schemas + fixtures + validation script enforcing message/domain invariants.
- **Documentation/specs (repo root + `docs/`)**: product scope, protocol semantics, manifests, UX mappings, and execution policies.

### Core design principle
- Server is authoritative for simulation and truth.
- Client is responsible for rendering, interpolation, and user interaction UX.

### Source-of-truth docs
- Product/runtime plan: `PLAN.md`
- Realtime message protocol: `PROTOCOL.md`
- Scene manifest contract: `SCENE_MANIFESTS.md`
- POI/UI/command mapping: `POI_AND_INTERACTIONS.md`
- Domain IDs/invariants: `DOMAIN_MODEL.md`
- Override-control policy: `USER_OVERRIDE_CONTROLS.md`

### Current code surface (as of this guide)
- `apps/client-web/src/scene`: camera, assets, rendering scaffolding
- `apps/client-web/src/network`: socket/reconnect lifecycle
- `apps/client-web/src/state`: world/ui/interaction stores
- `contracts/schemas`: envelope/domain schema definitions
- `contracts/fixtures`: golden and invalid fixtures
- `contracts/validation/run-validation.mjs`: schema + invariant checks

## 2) Flow-Level Operational Walkthrough

### A) Start-of-session
1. Read `AGENTS.md` and `README.md`.
2. Register and sync mail context (`macro_start_session` or `ensure_project` + `register_agent`).
3. Fetch inbox and acknowledge required messages.
4. Check active agents and current claims before selecting work.

### B) Select work
1. Run `bv --robot-triage` (or `bv --robot-next`) to identify highest-value ready work.
2. Confirm with `br ready --json`.
3. Avoid overlap with active `in_progress` beads and active file reservations.

### C) Claim and communicate
1. `br update <bead-id> --status in_progress`
2. Reserve file scope (`file_reservation_paths` with `reason=<bead-id>`).
3. Announce claim in Agent Mail thread (`thread_id=<bead-id>` or coordination thread).

### D) Implement and validate
1. Keep edits within reserved scope.
2. Run relevant validation commands.
   - Contracts gate (required for contract/schema/protocol/fixture changes):
     - `npm --prefix contracts ci`
     - `npm --prefix contracts run validate`
     - `npm --prefix contracts run validate:session-key`
   - Reference: `docs/contracts-validation-gates.md`
3. If blocked, send an Agent Mail update immediately with blocker details.

### E) Complete and close
1. `br close <bead-id> --reason "Completed"`
2. Release file reservations.
3. Post completion summary with files changed + validation evidence.

## 3) Practical `br` + Agent Mail Workflow

### Beads commands
```bash
br ready --json
bv --robot-triage
br show <bead-id>
br update <bead-id> --status in_progress
br close <bead-id> --reason "Completed"
```

### Agent Mail conventions
- Use `thread_id` equal to bead ID (`bd-###` now, `br-###` after migration).
- Subject prefix format: `[bd-###] ...` for consistency.
- Announce claim/start and completion in-thread.
- Acknowledge all `ack_required` messages promptly.

### File reservation pattern
- Reserve specific files/globs only.
- Set reservation reason to bead ID.
- Release reservations immediately after completion.

## 4) Failure and Edge Behavior

### Agent Mail timeout/degraded state
- Symptom: `fetch_inbox`/`send_message`/reservation calls timeout.
- Action:
  - continue isolated work on non-conflicting file scope
  - retry mail operations after each major step
  - post a catch-up summary once service recovers

### File reservation conflict
- Symptom: `conflicts` returned from reservation call.
- Action:
  - do not edit conflicting files
  - select a different ready bead or negotiate split in mail

### Bead blocked after triage
- Symptom: `bv` top pick blocked by dependencies.
- Action:
  - choose next actionable ready bead (`br ready --json`)
  - avoid waiting on blocked work unless explicitly assigned

### Validation failure
- Symptom: schema/type/build checks fail.
- Action:
  - treat as incomplete bead
  - include exact failing command and first actionable error line
  - include failure summary and remediation in mail
  - close bead only after checks pass or documented exception is agreed

### Dirty worktree in multi-agent runs
- Symptom: unrelated modified/untracked files from other agents.
- Action:
  - avoid reverting unrelated changes
  - confine edits to your scoped files
  - report exactly which files you changed

## 5) Validation Checklist for This Workflow
- Architecture map references current runtime and contract modules.
- Walkthrough includes claim -> reserve -> implement -> validate -> close -> notify.
- `br` and Agent Mail command usage is explicit and non-ambiguous.
- Failure/edge handling is documented with concrete contributor actions.
- References point to canonical docs to reduce future drift.
