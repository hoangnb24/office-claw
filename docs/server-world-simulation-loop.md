# Server-World Simulation Loop (bd-22h)

`apps/server-world/src/simulation.mjs` now owns the authoritative simulation clock and snapshot state for `/ws/world`.

## Deliverables

- Configurable tick rate bounded to `10-20 Hz`
- Monotonic simulation sequence (`seq`) and simulation clock (`clock_ms`)
- Deterministic replay behavior for identical command/event input streams
- Coherent authoritative snapshots for:
  - `agents`
  - `projects`
  - `tasks`
  - `artifacts`
  - `decisions`
  - `office_decor`

## Runtime Contract

- `createWorldServer({ tickRateHz })` accepts runtime tick-rate config.
- `/health` now includes simulation runtime stats and tick-rate bounds.
- Initial `snapshot` payload on subscribe includes:
  - `seq`
  - `clock_ms`
  - canonical entity arrays from the world-state store.

## Determinism/Coherence Checks

- `apps/server-world/test/simulation.test.mjs`
  - tick rate configurability + observability
  - deterministic replay equivalence
  - monotonic `seq`/`clock_ms`
  - snapshot coherence (`validateSnapshotCoherence`)
- `apps/server-world/test/worldServer.test.mjs`
  - lifecycle handshake coverage
  - command ack/error behavior
  - snapshot shape + coherence checks
  - exposed simulation stats checks

## Validation Commands

```bash
npm --prefix apps/server-world test
npm --prefix contracts run validate
```
