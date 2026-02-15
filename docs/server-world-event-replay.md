# Server-World Event Replay APIs (bd-3tf)

`apps/server-world/src/eventTimeline.mjs` now supports append-only replay with cursor paging and optional durable JSONL persistence.

## Event Log Model

- Events are append-only and strictly ordered by monotonic `seq`.
- Each persisted record includes:
  - `seq`
  - `event_id` (deterministic from sequence)
  - `ts`
  - semantic event payload fields

## Replay APIs

Timeline APIs:

- `readSince(seq, { limit, inclusive })`
- `replayFromCursor({ cursor, limit, inclusive })`
  - returns `{ events, cursor, next_cursor, has_more, latest_seq }`

World server APIs:

- `getEventTimeline({ sinceSeq, limit, inclusive })`
- `getEventReplayPage({ cursor, limit, inclusive })`
- `getEventTimelineStats()`
  - includes `oldest_seq`, `latest_seq`, `size`, and `persist_path`

## Durability

- Timeline accepts optional `persistPath` and writes append-only JSONL rows.
- On process restart, persisted rows are loaded and replay cursors continue from the latest sequence.

## Validation

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
