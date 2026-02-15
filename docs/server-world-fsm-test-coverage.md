# Server-World FSM and Lifecycle Test Coverage (`bd-ykl`)

Last updated: 2026-02-14

## Scope

Expanded simulation-level deterministic tests in `apps/server-world/test/simulation.test.mjs` to harden:
- FSM transition and override invariants
- impossible-state prevention
- task lifecycle coherence under review/decision flows

## Added Tests

### `testCeremonyOverrideStackDedupAndDeterministicDecay`

Covers deterministic override behavior for ceremony states:
- kickoff override is deduplicated by kind (no stacking duplicates)
- re-triggering kickoff resets and decays predictably
- override exits return `effective_state` to `base_state`

### `testFsmAndTaskLifecycleInvariantsRemainStable`

Covers complex lifecycle path:
1. assign task
2. kickoff override
3. request changes (block + decision)
4. resolve decision (resume)
5. approve latest artifact revision

Assertions:
- snapshot coherence remains valid
- no agent references terminal tasks
- all agent FSM records keep `invariant_violations == 0`

## Validation

```bash
npm --prefix apps/server-world test
```
