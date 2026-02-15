# Saved Query Set (bd-24y)

This project defines four saved queries for daily execution, milestone tracking, and blocked visibility.

## Saved query names

- `ready_daily`
  - open work in priorities P0-P2
  - command: `br query run ready_daily`
- `by_epic_open`
  - all open epics for roll-up tracking
  - command: `br query run by_epic_open`
- `milestone_gates`
  - open issues with `Milestone` in title (gate dashboard)
  - command: `br query run milestone_gates`
- `blocked_visibility`
  - open issues labeled `state:blocked`
  - command: `br query run blocked_visibility`
  - note: for dependency-based blocked list regardless of labels, use `br blocked`

## Reprovision commands

```bash
br query save ready_daily --description "Daily execution: open, high-priority active queue" --status open --priority-min 0 --priority-max 2 --sort priority
br query save by_epic_open --description "Open epics for roll-up tracking" --status open --type epic --sort priority
br query save milestone_gates --description "Milestone and gate tracking view" --status open --title-contains Milestone --sort priority
br query save blocked_visibility --description "Blocked work visibility (requires state:blocked label convention)" --status open --label state:blocked --sort priority
```

## Validation snapshot

Current counts at time of creation:
- `ready_daily`: 103
- `by_epic_open`: 11
- `milestone_gates`: 12
- `blocked_visibility`: 0

These counts will change as issue state changes.
