# bd-1mob - deterministic scene-only QA capture workflow

## Scope
Address KI-R03 from `bd-95kn` by adding a repo-owned deterministic capture path that produces scene-focused screenshots without overlay/panel chrome.

## Implemented changes
1. `tools/qa/capture-baseline-visuals.mjs`
- Added `--scene-only` flag.
- Added a dedicated scene-only execution path that uses `agent-browser` commands directly.
- Scene-only flow performs deterministic interaction steps, then hides `.overlay-root` immediately before each screenshot and restores it after capture.
- Writes:
  - `capture-summary.json`
  - `runtime-defects.md`
  - `command-log.txt`
  - `screenshots/*.png`

2. `docs/client-polish-baseline-capture-playbook.md`
- Added a `Scene-Only Capture Variant (bd-1mob)` section.
- Documented invocation and output expectations.

## Validation
- `node --check tools/qa/capture-baseline-visuals.mjs` ✅
- `npm --prefix apps/client-web run typecheck` ✅
- `npm --prefix apps/client-web run build` ✅

## Evidence run
Executed script output:
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/`

Artifacts:
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/capture-summary.json`
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/command-log.txt`
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/runtime-defects.md`
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/screenshots/VQA-01-scene-only-default-view.png`
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/screenshots/VQA-02-scene-only-camera-focus.png`
- `reports/client-polish/qa/scene-only-bd-1mob/20260216T023021Z/screenshots/VQA-03-scene-only-navigation.png`

## Outcome
- Deterministic scene-only screenshot automation is now available in-repo.
- Capture workflow no longer depends on ad-hoc manual panel hiding for scene-focused walkthrough evidence.
