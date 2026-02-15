# Session Trace Export/Import Utilities (bd-2vn)

`tools/session-trace.mjs` provides non-production utilities to export/import event + command traces for deterministic demo replay and debugging.

## Guardrails

- Tool is blocked by default unless one of:
  - `OFFICECLAW_NON_PROD=1`
  - `--non-prod-ok`
- Import of sensitive traces is blocked unless `--allow-sensitive`.
- Existing output files are protected unless `--allow-overwrite`.

## Export

```bash
node tools/session-trace.mjs export \
  --events <events.jsonl> \
  --commands <commands.jsonl> \
  --out <trace.json> \
  --max-events 5000 \
  --max-commands 5000 \
  --non-prod-ok
```

Defaults:
- redaction enabled (`include_sensitive=false`)
- outputs a single JSON trace bundle with metadata and bounded arrays

Use `--include-sensitive` only in trusted non-production environments.

## Import

```bash
node tools/session-trace.mjs import \
  --in <trace.json> \
  --events-out <events.jsonl> \
  --commands-out <commands.jsonl> \
  --allow-overwrite \
  --non-prod-ok
```

Import restores JSONL files that can be consumed by replay/debug tooling.

## Example Artifact

- `reports/session-trace-example.json`

## Validation

```bash
node tools/session-trace.mjs export \
  --events /tmp/officeclaw-missing-events.jsonl \
  --commands /tmp/officeclaw-missing-commands.jsonl \
  --out reports/session-trace-example.json \
  --non-prod-ok

node tools/session-trace.mjs import \
  --in reports/session-trace-example.json \
  --events-out /tmp/officeclaw-imported-events.jsonl \
  --commands-out /tmp/officeclaw-imported-commands.jsonl \
  --allow-overwrite \
  --non-prod-ok
```
