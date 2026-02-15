# Server-World State Restoration (bd-3hb)

`apps/server-world/src/worldServer.mjs` now boots through a restoration pipeline that replays persisted commands and enforces a consistency gate before accepting new commands.

## Startup Restoration Flow

- `createStateRestorationPipeline({ commandJournalPath, simulation })` loads journal records from disk.
- Journal records are replayed in ascending `journal_seq` order through `simulation.applyCommand(...)`.
- After replay, the server runs one reconciliation tick and validates snapshot coherence.
- Restoration stats are exposed to the server runtime and `/health`.

## Command Consistency Gate

- Commands are accepted only when restoration is `ready` and `consistency_ok`.
- If restoration coherence fails (for example, replayed rejected commands from a bad journal), command handling returns protocol `error` with code `NOT_ALLOWED`.
- Successful command acks are persisted back to the journal with session and `in_reply_to` context.

## Runtime Observability

- `/health` now includes `state_restoration`:
  - `ready`
  - `consistency_ok`
  - `loaded_records`
  - `replayed_ok`
  - `replayed_rejected`
  - `reconciled_ticks`
  - `command_journal_path`
  - `next_journal_seq`
- Server accessor: `getStateRestorationStats()`

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
