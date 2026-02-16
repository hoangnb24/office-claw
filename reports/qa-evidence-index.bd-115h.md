# QA Evidence Index and Trace Links (`bd-115h`)

Generated at: `2026-02-15T14:02:26Z`  
Agent: `MagentaTower`

## Scope

Canonical Phase-9 QA evidence registry covering screenshots, videos, reports, logs, metrics, and deterministic session-trace outputs.

## Reproducibility Check

- Manifest list: `reports/client-polish/evidence-index/20260215T140226Z/artifact-paths.txt`
- Path validation output: `reports/client-polish/evidence-index/20260215T140226Z/path-check.txt`
- Validation summary: `found=40`, `missing=0`

## Indexed Artifacts

### Reports

- `reports/offline-visual-qa-sweep.bd-t9jf.md`
- `reports/visual-qa-online.bd-3uwh.md`
- `reports/visual-qa-both-modes.bd-3vgq.md`
- `reports/offline-session-trace-export.bd-1cx3.md`
- `reports/user-facing-success-checklist.bd-v0c9.md`
- `reports/performance-optimization-before-after.bd-lfez.md`

### Offline QA Package (`bd-t9jf`)

- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/command-log.txt`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/scenario-checks.json`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/runtime-defects.md`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/runtime-metrics.json`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/events.jsonl`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/commands.jsonl`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/events.snapshot.json`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/scene-fingerprint.sha1`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/asset-fingerprints.sha1`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/page-errors.log`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/page-errors-verify.log`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/console.log`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/screenshots/VQA-01-hitbox-target-resolution.png`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/screenshots/VQA-02-camera-focus-panel-anchor.png`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/screenshots/VQA-03-highlight-lifecycle.png`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/screenshots/VQA-04-event-feed-linkage.png`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/screenshots/VQA-05-navigation-debug-overlays.png`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/screenshots/VQA-06-agent-inspector.png`
- `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/walkthrough/offline-walkthrough.webm`

### Online QA Package (`bd-3uwh`)

- `reports/client-polish/online-vqa/20260215T135214Z/logs/browser-console.txt`
- `reports/client-polish/online-vqa/20260215T135214Z/logs/browser-errors.txt`
- `reports/client-polish/online-vqa/20260215T135214Z/screenshots/VQA-01-hitbox-target-resolution.png`
- `reports/client-polish/online-vqa/20260215T135214Z/screenshots/VQA-02-camera-focus-panel-anchor.png`
- `reports/client-polish/online-vqa/20260215T135214Z/screenshots/VQA-03-highlight-lifecycle.png`
- `reports/client-polish/online-vqa/20260215T135214Z/screenshots/VQA-04-event-feed-linkage.png`
- `reports/client-polish/online-vqa/20260215T135214Z/screenshots/VQA-05-navigation-debug-overlays.png`
- `reports/client-polish/online-vqa/20260215T135214Z/screenshots/VQA-06-agent-inspector.png`

### Session Trace Package (`bd-1cx3`)

- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/offline-session-trace.json`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/offline-session-trace.sha1`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/export-result.json`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/import-result.json`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/import-check/events.jsonl`
- `reports/client-polish/trace/bd-1cx3/20260215T135832Z/import-check/commands.jsonl`

### Performance Context

- `reports/perf/bd-lfez-current-metrics.jsonl`

## Notes

- Browser-driven QA interactions in source artifacts were executed with `agent-browser` in the contributing beads.

## Acceptance Mapping

1. Index references required artifacts: **met** (40-path canonical manifest and categorized registry).
2. Links are valid and reproducible: **met** (`path-check.txt` records `missing=0`).
