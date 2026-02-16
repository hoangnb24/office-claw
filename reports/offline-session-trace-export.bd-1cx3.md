# Offline Session Trace Export (`bd-1cx3`)

Generated: `2026-02-15T13:59:00Z`  
Agent: `RainyDune`

## Goal

Export a deterministic offline session trace artifact (with provenance) from the canonical offline QA sweep outputs for regression analysis and handoff.

## Input Sources

From `bd-t9jf` canonical offline QA run:

- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/events.jsonl`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/commands.jsonl`

## Export Command

```bash
node tools/session-trace.mjs export \
  --events reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/events.jsonl \
  --commands reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/commands.jsonl \
  --out reports/client-polish/trace/bd-1cx3/20260215T135832Z/offline-session-trace.json \
  --non-prod-ok
```

## Validation Command

```bash
node tools/session-trace.mjs import \
  --in reports/client-polish/trace/bd-1cx3/20260215T135832Z/offline-session-trace.json \
  --events-out reports/client-polish/trace/bd-1cx3/20260215T135832Z/import-check/events.jsonl \
  --commands-out reports/client-polish/trace/bd-1cx3/20260215T135832Z/import-check/commands.jsonl \
  --allow-overwrite \
  --non-prod-ok
```

## Export Result

- `event_count`: `6`
- `command_count`: `9`
- `include_sensitive`: `false`

Command outputs:

- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/export-result.json`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/import-result.json`

## Stored Trace Artifact

- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/offline-session-trace.json`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/offline-session-trace.sha1`

## QA Evidence Cross-Reference

The offline QA gate report now references this trace artifact:

- `reports/offline-visual-qa-sweep.bd-t9jf.md`

This satisfies the requirement that the trace output is stored in `reports` and explicitly linked from QA evidence.
