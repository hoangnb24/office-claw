# Dual-Mode Visual QA Synthesis (`bd-3vgq`)

Generated at: `2026-02-15T13:59:30Z`  
Agent: `PurpleOtter`

## Objective

Consolidate deterministic visual QA outcomes across both launch modes (offline + online), with scenario-tagged evidence and explicit cross-mode defect/risk conclusions.

## Source Runs

1. Offline sweep (`bd-t9jf`): `reports/offline-visual-qa-sweep.bd-t9jf.md`
2. Online sweep (`bd-3uwh`): `reports/visual-qa-online.bd-3uwh.md`

## Evidence Packages

1. Offline package: `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/`
2. Online package: `reports/client-polish/online-vqa/20260215T135214Z/`

## Cross-Mode Scenario Matrix

| Scenario | Offline (`bd-t9jf`) | Online (`bd-3uwh`) | Cross-Mode Verdict | Key Evidence |
| --- | --- | --- | --- | --- |
| `VQA-01` Hitbox target resolution | pass | pass | consistent-pass | `.../offline-bd-t9jf/.../VQA-01-hitbox-target-resolution.png`, `.../online-vqa/.../VQA-01-hitbox-target-resolution.png` |
| `VQA-02` Camera focus + panel anchoring | fail | pass | **mode divergence** | `.../offline-bd-t9jf/.../VQA-02-camera-focus-panel-anchor.png`, `.../online-vqa/.../VQA-02-camera-focus-panel-anchor.png` |
| `VQA-03` Highlight lifecycle | fail | pass | **mode divergence** | `.../offline-bd-t9jf/.../VQA-03-highlight-lifecycle.png`, `.../online-vqa/.../VQA-03-highlight-lifecycle.png` |
| `VQA-04` Event feed linkage | fail | pass | **mode divergence** | `.../offline-bd-t9jf/.../VQA-04-event-feed-linkage.png`, `.../online-vqa/.../VQA-04-event-feed-linkage.png` |
| `VQA-05` Navigation + debug overlays | pass | pass | consistent-pass | `.../offline-bd-t9jf/.../VQA-05-navigation-debug-overlays.png`, `.../online-vqa/.../VQA-05-navigation-debug-overlays.png` |
| `VQA-06` Agent inspector state/task/blockers | pass | pass | consistent-pass | `.../offline-bd-t9jf/.../VQA-06-agent-inspector.png`, `.../online-vqa/.../VQA-06-agent-inspector.png` |

## Consolidated Defects / Risks

1. `MD-001` high: Offline-only event-driven focus linkage regression (`VQA-02`, `VQA-04`).
- Offline run reports `Focused POI` and `Focused agent` failing to transition from `none`.
- Online run passes same scenarios.
- Impact: release-candidate behavior diverges by runtime mode; breaks parity expectations.

2. `MD-002` high: Offline-only highlight lifecycle validation blocked by missing focus transitions (`VQA-03`).
- Offline run cannot demonstrate highlight reset/reapply due upstream focus failure.
- Online run passes highlight lifecycle scenario.

3. `MD-003` medium: Offline performance stress remains severe during QA sweep (`fps ~1.3`, `frameP95Ms ~1231.5`, hotspot `~98.9%`).
- Online sweep logs no blocking runtime defects in corresponding run window.

## Outcome

- Dual-mode checklist execution: **complete** (all six scenarios executed in both modes).
- Dual-mode parity status: **not passing** due offline-only failures in `VQA-02/03/04`.
- Recommendation: treat `MD-001`/`MD-002` as blockers for parity-driven polish signoff; carry evidence into `bd-v0c9` and `bd-37hw` decision packets.

## Acceptance Mapping

1. All checklist scenarios executed in both modes: **met**.
2. Evidence package contains screenshots/recordings with scenario tags: **met**.

## Linked Artifacts

1. Offline checks: `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/scenario-checks.json`
2. Offline runtime defects: `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/runtime-defects.md`
3. Offline walkthrough: `reports/client-polish/qa/offline-bd-t9jf/20260215T135153Z/walkthrough/offline-walkthrough.webm`
4. Online screenshots: `reports/client-polish/online-vqa/20260215T135214Z/screenshots/`
5. Online logs: `reports/client-polish/online-vqa/20260215T135214Z/logs/browser-console.txt`, `reports/client-polish/online-vqa/20260215T135214Z/logs/browser-errors.txt`
