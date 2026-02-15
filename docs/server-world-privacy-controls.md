# Server-World Privacy Controls (bd-1tv)

`apps/server-world/src/privacyControls.mjs` and `apps/server-world/src/worldServer.mjs` now enforce baseline privacy defaults for logs, telemetry, and diagnostic exports.

## Redaction Middleware

- Structured payload redaction is applied for sensitive keys (examples: `text`, `instructions`, `prompt`, `choice`, `token`, `session_key`, `authorization`, `content`, `body`).
- Server structured logs now emit redacted payloads through a single middleware path.
- Protocol/observability records retain traceability metadata while removing sensitive freeform content.

## Retention Pruning Hooks

- Deterministic pruning for in-memory diagnostics state:
  - `diagnosticsRetentionMaxEntries`
  - `diagnosticsRetentionMaxAgeMs`
- Applies to lifecycle diagnostics and recent error buffers.
- Retention state is surfaced in observability and `/health`.

## Safe Export Defaults

- `exportDiagnostics()` returns **redacted output by default** (`includeSensitive: false`).
- Explicit opt-in required for sensitive export: `exportDiagnostics({ includeSensitive: true })`.
- Export bundle includes bounded diagnostics slices:
  - lifecycle log
  - observability snapshot
  - event timeline

## Health/Observability Surface

- `/health` now includes `privacy_controls`:
  - `diagnostics_retention.max_entries`
  - `diagnostics_retention.max_age_ms`
  - `export_default_redacted`
- `getObservabilityStats()` includes retention metadata and recent redacted errors.

## Validation

```bash
node apps/server-world/test/privacyControls.test.mjs
node apps/server-world/test/worldServer.test.mjs
npm --prefix contracts run validate
```
