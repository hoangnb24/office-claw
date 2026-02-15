# Server World Player Position Cache

Related bead: `bd-37y`

## Overview

Implemented optional `player_pos` ingestion enhancements in `apps/server-world/src/worldState.mjs` to support seek-user behavior with deterministic fallback semantics.

## Delivered

- Added player-position cache runtime with freshness policy:
  - `freshness_window_ticks = 6`
  - cache status states: `fresh | stale | unavailable`
- `player_pos` command now updates:
  - canonical player agent position/facing
  - cached position/facing + cache update tick
- Integrated blocked-agent seek-user hook:
  - when blocked assignee is in `SeekingUserDecision`, agent movement now uses:
    1. fresh cached player position, otherwise
    2. deterministic fallback position (seeded player spawn)
  - transition reasons are explicit for observability/debugging:
    - `seek_user_player_pos_fresh`
    - `seek_user_fallback_stale`
    - `seek_user_fallback_unavailable`
- Added debug accessor:
  - `getPlayerPositionContext()`
  - exposes status, cached values, cache age, freshness window, and fallback target

## Test Coverage

- `apps/server-world/test/simulation.test.mjs`
  - added `testPlayerPosCacheFreshnessAndSeekUserFallbackBehavior()`
  - validates:
    - unavailable-cache fallback behavior
    - fresh-cache seek-user movement toward live `player_pos`
    - stale-cache fallback behavior and movement toward deterministic fallback target

## Validation

- `npm --prefix apps/server-world test`
- `npm --prefix contracts run validate`
