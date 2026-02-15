# Issue Template Guidelines (bd-13k)

This project uses three reusable issue templates in `.beads/templates/`:

- `epic.md`
- `task.md`
- `subtask.md`

## Section intent

- `Background`: minimum context to avoid rediscovery.
- `Intent`: desired outcome (not just implementation details).
- `Scope`: explicit deliverables and in/out boundaries.
- `Non-goals`: items intentionally excluded from current work.
- `Definition of Done (DoD)`: objective completion checks.

## Usage examples

### Technical task example

Title: `Implement command router validation middleware`

- Background: protocol contract requires deterministic `ack`/`error` outcomes for all commands.
- Intent: prevent inconsistent server behavior and simplify UI error handling.
- Scope: middleware wiring, validation map, tests for unknown/malformed commands.
- Non-goals: full business logic handlers for each command.
- DoD: validation tests pass and docs are updated.

### Product/process task example

Title: `Define onboarding narrative milestones`

- Background: first-run users need predictable path to time-to-first-value.
- Intent: improve completion rate of first request flow.
- Scope: milestone sequence, copy tone rules, measurable success criteria.
- Non-goals: final UI pixel polish or animation treatment.
- DoD: design doc is reviewable and implementation handoff-ready.

## Creation checklist

1. Choose template (`epic`, `task`, `subtask`) based on dependency role.
2. Fill all sections before creation; avoid empty placeholders.
3. Ensure DoD can be validated by another contributor.
4. Link dependencies/parent ids at creation time when known.
5. Add follow-up tasks instead of expanding scope mid-task.
