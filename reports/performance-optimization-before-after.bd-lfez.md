# `bd-lfez` Optimization Before/After Report

Generated at: `2026-02-15T13:50:00Z`  
Agent: `MagentaTower`

## Scope

Consolidate measurable performance outcomes after phase-8 optimization passes and document tradeoffs/regressions for downstream QA gating.

Optimization lanes included:
- `bd-2nhs` debug/telemetry gating
- `bd-qg4i` render policy controls
- `bd-295o` compression pipeline
- `bd-2iss` runtime-provider instance-group batching + activation

## Sources

- Baseline: `reports/runtime-metrics-baseline.md` (`bd-xlo`)
- Prior benchmark snapshots: `reports/runtime-metrics-bd-50t4.md`, `reports/instancing-benchmark.bd-50t4.md`
- Current post-`bd-2iss` capture: `reports/perf/bd-lfez-current-metrics.jsonl`
- Runtime smoke evidence: `reports/client-polish/instancing-batching/20260215T134548Z/runtime-loaded-post-instance-group.png`

## Current Capture Method (post-`bd-2iss`)

- URL: `http://127.0.0.1:4173/`
- Runner: `agent-browser`
- Capture file: `reports/perf/bd-lfez-current-metrics.jsonl`
- Sequence:
  1. warm-up wait
  2. 3 idle samples (3s spacing)
  3. deterministic interaction sequence (`Alt+1..7`, `Alt+Shift+D` x3 with waits)
  4. 3 interaction samples (3s spacing)

## Scenario Averages

| Scenario | FPS | Frame p95 (ms) | Hotspot % | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline (bd-xlo) Idle | 72.1 | 16.0 | 2.9 | 124 | 6,046 |
| Baseline (bd-xlo) Interaction | 14.3 | 90.8 | 98.0 | 122 | 489,006 |
| Post-`bd-2iss` Idle | 5.0 | 401.8 | 96.0 | 11 | 292,678 |
| Post-`bd-2iss` Interaction | 3.4 | 521.6 | 98.9 | 19 | 488,034 |

## Delta vs Baseline (Post-`bd-2iss`)

| Scenario | FPS Δ | Frame p95 Δ | Hotspot % Δ | Draw calls Δ | Triangles Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | -67.1 (-93.1%) | +385.8 (+2411.3%) | +93.1 (+3211.5%) | -113 (-91.1%) | +286,632 (+4740.9%) |
| Interaction | -10.9 (-76.2%) | +430.8 (+474.4%) | +0.9 (+1.0%) | -103 (-84.4%) | -972 (-0.2%) |

## Delta vs Prior `bd-50t4` Snapshot (RainyDune report)

| Scenario | FPS Δ | Frame p95 Δ | Hotspot % Δ | Draw calls Δ | Triangles Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | +1.4 (+38.0%) | -282.2 (-41.3%) | +2.1 (+2.3%) | -3 (-21.4%) | -195,032 (-40.0%) |
| Interaction | +0.8 (+30.8%) | -177.6 (-25.4%) | +0.8 (+0.8%) | +5 (+35.7%) | +324 (+0.1%) |

## Tradeoffs and Regressions

1. Draw-call improvements are clear vs baseline, but frame-time remains far above baseline in this local capture path.
2. Interaction draw calls increased vs one `bd-50t4` snapshot (19 vs 14) after activating extra repeated decor objects for batching verification; this is expected scene-content pressure, not a batching failure by itself.
3. Hotspot percentages remain critical in both scenarios, indicating remaining runtime bottlenecks beyond draw-call count.
4. Capture comparability remains sensitive to local runtime/browser path; use trends, not single-run absolutes, for release gating.

## Instancing Activation Evidence

1. `bd-2iss` introduced provider-owned batching (`derived.instancedAssembly`, `derived.instancingStats`).
2. Scene now includes eligible repeated objects:
   - `decor_cone_cluster_a`
   - `decor_cone_cluster_b`
   - shared `instance_group: decor_cone_cluster`
3. Compatibility sanity check confirms an eligible repeated bucket:
   - `decor_cone_cluster|/assets/blocker_cone.glb|false|false|`

## Conclusion

Phase-8 optimization work delivers strong draw-call reduction directionally, but frame-time/hotspot regressions remain significant in this capture environment. For phase-9 QA gating, treat this as optimization-progress evidence with explicit caveats, not final performance signoff.
