# Runtime Defects (`bd-t9jf` offline sweep)

Run dir: `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z`
Date (UTC): `2026-02-15T13:55:43Z`

## Summary

- Page errors: none (`page-errors.log`, `page-errors-verify.log` are empty)
- Console warnings: present (React Router future flags, WebGL GPU stall warnings)
- Offline parity defects: **present** (event-driven focus linkage)

## Defects

| ID | Severity | Area | Evidence | Description |
| --- | --- | --- | --- | --- |
| `OD-001` | high | offline parity / event routing | `scenario-checks.json`, `screenshots/VQA-02-camera-focus-panel-anchor.png`, `screenshots/VQA-04-event-feed-linkage.png` | Event Feed click flow did not set `Focused POI` or `Focused agent` (remained `none` in deterministic checks), indicating broken event-driven focus linkage in offline run. |
| `OD-002` | medium | runtime performance | `runtime-metrics.json`, `console.log` | Debug HUD snapshot shows critical perf (`fps=1.3`, `frameP95Ms=1231.5`, hotspot `98.9%`). This is a severe runtime quality risk for polish QA readability. |
| `OD-003` | low | console noise | `console.log` | React Router v7 future-flag warnings repeated in console; does not break flow but pollutes QA signal. |
| `OD-004` | low | GPU diagnostics | `console.log` | WebGL driver warnings: `GPU stall due to ReadPixels`. Non-fatal but relevant to perf interpretation during automated capture. |

## Notes

- `OD-001` is treated as the primary offline parity defect for this bead.
- No uncaught runtime exceptions were observed.
