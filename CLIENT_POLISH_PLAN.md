# Client Polish Plan (Pre-Backend Integration)

Last updated: 2026-02-15

## Objective

Deliver a polished **offline** client where the Cozy Office world feels complete and production-ready before integrating real backend/services.

Primary outcomes:
- Proper background and environment art (not placeholder blocks).
- Proper objects and world dressing.
- Reliable interactions and panel behavior.
- Smooth movement and walk-to-interact.
- Good runtime performance and clean UX presentation.

## Non-goals for this polish pass

These items are important but should not block the offline polish milestone:
1. Real multi-user synchronization across clients.
2. Final server-authored simulation correctness.
3. Perfect collision fidelity (box colliders are acceptable for v0).
4. Full editor tooling (only lightweight authoring helpers are in scope).

## Current Problem Summary

1. Placeholder assets are still being loaded in `apps/client-web/public/assets/**`.
2. Scene rendering is scaffold/catalog-driven in `apps/client-web/src/scene/OfficeScene.tsx` while manifest scene loading exists but is not the active render path.
3. Scene manifest usage is duplicated across runtime systems (`assets/scenes/**` plus `apps/client-web/src/scene/highlight/cozy_office_v0.scene.json`), which can drift.
4. Offline mock mode is active, but command/panel parity is incomplete and UI dispatchers can fail when no world socket client is available.
5. Navigation has anchor/collider inconsistencies (for example, delivery shelf anchor on blocked cell).
6. Debug overlays and always-on runtime telemetry make the default experience noisier than desired.

## Guiding Principles

1. One source of truth for scene wiring: the scene manifest defines POIs, interactables, nav grid, and colliders, with contract definitions in `contracts/schemas/scene-manifest.schema.json` and `contracts/types/scene-manifest.ts`.
2. One runtime scene data path: scene render, nav, focus, and highlight consume the same manifest-derived runtime data.
3. Contract-first asset acceptance (Meshy output must pass clip + preflight checks).
4. Offline parity by abstraction: dispatchers call a command gateway, not WebSocket client singletons directly.
5. Fail soft: manifest/load problems are visible and actionable (issue reporting), not silent drift.
6. Treat `apps/client-web/public/**` as generated runtime output; do not hand-edit it.
7. Use repo-relative commands in docs and CI recipes (no machine-specific absolute paths).
8. Measurable gates per phase, with explicit pass/fail criteria.

## Phase Plan

## Phase 0: Baseline Freeze

Purpose: lock a before-state to measure polish progress.

Tasks:
1. Follow the baseline procedure in `docs/client-polish-baseline-capture-playbook.md`.
2. Capture baseline screenshots and a short walkthrough video.
3. Record current runtime metrics from Debug HUD:
- FPS
- frame p95
- hotspot rate
- draw calls
- triangle count
4. Record known console warnings and runtime defects.
5. Save the exact manifest and asset versions used for baseline (commit hash + file references).
6. Capture baseline Scene Issues output (asset failures, manifest issues, nav anchor issues) in a report.
7. Fill report from `reports/client-polish-evidence.template.md`.

Deliverables:
1. `docs/client-polish-baseline-capture-playbook.md`
2. `reports/client-polish-evidence.template.md`
3. run artifacts under `reports/client-polish/baseline/<run_id>/`
4. baseline screenshots under `reports/client-polish/baseline/<run_id>/screenshots/`
5. baseline defect list in `reports/client-polish/baseline/<run_id>/runtime-defects.md`

Exit criteria:
1. Baseline is documented and reproducible.

## Phase 1: Art Direction and Asset Backlog Lock

Purpose: define exactly what "polished Cozy Office" means and freeze the production inventory.

Tasks:
1. Finalize visual direction:
- color mood
- material style
- clutter density
- lighting tone
2. Lock asset backlog and IDs using `CLIENT_ART_PRODUCTION_LIST.md` as the inventory source of truth.
3. Prepare image references per asset for Meshy generation.
4. Lock node naming contract for interaction highlights (`highlight_nodes`) to avoid rework.
5. For each interactable, define collider recommendation + nav anchor recommendation.

Deliverables:
1. `docs/client-polish-art-direction.md`
2. `docs/client-polish-asset-backlog.md`
3. `CLIENT_ART_PRODUCTION_LIST.md` (authoritative art inventory + priority order)

Exit criteria:
1. Asset list, naming contract, and visual targets are explicit and approved.

## Phase 2: Asset Production and Validation

Purpose: produce final GLBs and ship immediate visual uplift while enforcing content contracts.

Tasks:
1. Implement (or fast-track from Phase 3) runtime sync so `apps/client-web/public/**` is generated output from `assets/**`.
2. Replace P0 placeholders by updating canonical source assets under `assets/glb/**`, then sync to `apps/client-web/public/**`.
3. Add a portable wrapper script for Meshy work-order generation in-repo (for example `tools/meshy_build_work_order.py`).
4. Generate Meshy work order(s) with repo-relative paths:
```bash
python3 tools/meshy_build_work_order.py \
  --project-root . \
  --image <img1> --image <img2> \
  --asset-id <asset_id>
```
5. Run Meshy pipeline dry-run, then real generation:
```bash
python tools/meshy_pipeline.py --image <img1> --image <img2> --asset-id <asset_id> --dry-run
python tools/meshy_pipeline.py --image <img1> --image <img2> --asset-id <asset_id> --output-dir assets/glb --manifest-out reports/meshy-<asset_id>-manifest.json
```
6. Normalize animation clips for agent assets:
```bash
node tools/glb-normalize-clips.mjs --in assets/glb/<agent>_animations.glb
```
7. Run preflight validation:
```bash
node tools/glb-preflight.mjs \
  --scene assets/scenes/cozy_office_v0.scene.json \
  --asset-root assets/glb \
  --report reports/glb-preflight-report.md
```
8. Track per-asset budget checks (triangles, materials, texture dimensions) in a summary report.
9. Define and enforce explicit P0/P1/P2 budget limits (not only ad-hoc tracking).

Asset acceptance rules:
1. Required clips present for agents: `Idle`, `Walk`, `Work_Typing`, `Think` (optional `Carry`).
2. No preflight `ERROR` items.
3. Any `WARN` items are explicitly reviewed.
4. Budget exceptions are explicit and justified.

Deliverables:
1. final GLBs in `assets/glb/`
2. Meshy manifests in `reports/`
3. updated `reports/glb-preflight-report.md` with zero blocking errors
4. `reports/asset-budget-summary.md`
5. synced runtime assets under `apps/client-web/public/**` generated from `assets/**`

Exit criteria:
1. P0 visual uplift is present and required runtime assets pass contract checks.

## Phase 3: Runtime Asset and Manifest Path Unification

Purpose: remove authoring/runtime drift and eliminate duplicated manifest sources.

Tasks:
1. Adopt a single path strategy:
- Authoring source of truth: `assets/**`
- Runtime served assets: `apps/client-web/public/**`
2. Add a sync helper (`tools/sync-runtime-assets.mjs`) to copy:
- `assets/glb/**` -> `apps/client-web/public/assets/**`
- `assets/scenes/**` -> `apps/client-web/public/scenes/**`
3. Standardize manifest/runtime URLs to served paths (prefer `/assets/...` and `/scenes/...`).
4. Remove runtime imports of duplicated manifest JSON under `apps/client-web/src/scene/highlight/`.
5. Keep one authoritative manifest contract by referencing `contracts/` schema + types.
6. Add contract validation gate in CI and local checklists:
```bash
node contracts/validation/run-validation.mjs
```
7. Add scene id configurability (for example `VITE_SCENE_ID`) to reduce hardcoded `cozy_office_v0` coupling.

Deliverables:
1. `docs/client-asset-path-strategy.md`
2. sync helper + npm script entrypoints
3. unified manifest/runtime references in client systems
4. `docs/scene-manifest-contract.md` (references `contracts/` definitions)

Exit criteria:
1. Runtime loads final assets from one predictable public root.
2. Runtime systems no longer depend on a second manifest file path.

## Phase 4: Manifest-Driven Scene Composition

Purpose: make manifest loader output the actual scene runtime consumed by all systems.

Tasks:
1. Introduce a `SceneRuntimeProvider` (React context/store) as the only entry point for:
- fetching and validating manifest from a served path (for example `/scenes/cozy_office_v0.scene.json`)
- loading shell and objects via `AssetManager`
- computing derived runtime indices (POI map, interactable ids, collider ids)
- surfacing load progress and actionable issues
2. Wire scene rendering to provider output (internally can call `loadSceneFromManifest(...)`).
3. Migrate nav/highlight/focus to consume provider data and remove direct JSON imports under `apps/client-web/src/scene/highlight/`.
4. Remove scaffold geometry as primary content (debug-only fallback).
5. Move interaction wiring fully to manifest data (`interaction`, `panel`, `command`, `poi_id`, `interaction_radius_m`, `highlight_nodes`) and remove per-asset hardcoding.
6. Add optional manifest `ui` metadata (label/tooltip/cursor) for Phase 7 affordances.
7. Ensure scene/nav/focus/highlight consume the exact same runtime bundle instance (no per-subsystem re-parse/recompute).
8. Keep fallback geometry only for non-critical failures.
9. Expose load progress + issues via a lightweight in-client overlay (demo-clean and actionable).
10. Define loading order policy: shell first, critical interactables second, decor last.

Deliverables:
1. `SceneRuntimeProvider` implementation with typed API
2. manifest-driven `OfficeScene` integration (no `sceneAssetCatalog` primary path)
3. unified manifest consumption across render/nav/focus/highlight (no cozy office JSON imports from `src/scene/highlight/`)
4. reduced hardcoded interaction wiring
5. load progress + issue reporting surface

Exit criteria:
1. Scene/object placement and interaction mapping come from manifest runtime data.
2. No alternate runtime manifest path remains.

## Phase 5: Interaction and Navigation Reliability

Purpose: ensure movement and POI interactions feel consistent and robust.

Tasks:
1. Fix all anchor reachability issues in manifest/nav runtime.
2. Resolve collider and walkability conflicts.
3. Tune `interaction_radius_m` and nav anchors for natural walk-to-interact.
4. Validate deterministic hit targeting for POIs and agents.
5. Ensure nav-to-panel routing uses manifest interaction metadata (no static command-to-panel tables).
6. Add nav preflight gate (`tools/nav-preflight.mjs`) that fails on unreachable POI anchors.
7. Add lightweight dev authoring helper for fast anchor/collider iteration (coordinate capture + optional patch output).
8. Add a manifest hot-reload helper in dev (manual trigger is sufficient).

Deliverables:
1. updated `assets/scenes/cozy_office_v0.scene.json`
2. nav preflight tool + `reports/nav-preflight-report.md`
3. no recurring nav anchor warning during normal use

Exit criteria:
1. POI click behavior is predictable and stable across flows.
2. All POI anchors are reachable under current colliders.

## Phase 6: Offline Behavior Parity

Purpose: make offline polish testing trustworthy before backend integration.

Tasks:
1. Add a typed `CommandGateway` abstraction so UI dispatchers never call `getWorldSocketClient()` directly.
2. Provide gateway implementations:
- `WorldSocketGateway` (wraps `WorldSocketClient`)
- `OfflineGateway` (deterministic command simulation with ack/error and store updates)
3. Ensure offline gateway supports the full UI golden-loop command set:
- `submit_request`
- `assign_task`, `auto_assign`
- `resolve_decision`
- `approve_artifact`, `request_changes`, `split_into_tasks`
4. Match live UI contract in offline mode: success/error notices and state transitions use the same surface (no connection-dead-end microcopy).
5. Keep deterministic synthetic timeline while matching expected panel behavior.
6. Optional high-ROI add: scripted demo flow hotkey for a repeatable 60-90s polished path (driven through gateway calls).

Deliverables:
1. offline-safe command handling path
2. offline decision/artifact parity with visible state updates
3. gateway interface + runtime selection wiring

Exit criteria:
1. Offline mode provides complete demo-quality workflow without backend dependency.
2. Offline demo path has no "connection unavailable" dead-end microcopy.
3. Offline and online flows share one command dispatch surface (gateway), reducing backend integration churn.

## Phase 7: Visual Polish Pass

Purpose: deliver the Cozy Office look-and-feel.

Tasks:
1. Final lighting/background pass with polished assets.
2. Improve prop placement and spatial storytelling.
3. Add POI affordances driven by manifest UI metadata:
- hover tooltip/label
- subtle focus ring/floor marker
- pointer cursor changes on interactables
4. Keep debug UI available but disable debug clutter by default for polish demos.
5. Verify focus/highlight presentation quality.
6. Use manifest `ui_anchor` and `camera_framing` where present for framing/anchoring consistency.

Deliverables:
1. final visual pass screenshots
2. updated style and scene tuning values

Exit criteria:
1. Scene reads as a coherent, polished office world.

## Phase 8: Performance Hardening

Purpose: improve smoothness and reduce frame-time spikes.

Tasks:
1. Profile frame spikes and remove highest-cost bottlenecks.
2. Enforce render/shadow/material budgets for new assets.
3. Re-check runtime telemetry after each optimization batch.
4. Add instancing/static batching for repeated props:
- use manifest `instance_group` to batch identical meshes into `InstancedMesh`
- prioritize clutter/decor groups to keep draw calls bounded
5. Add compression pipeline if feasible:
- Draco mesh compression
- KTX2/Basis texture compression
6. Add culling and shadow policy controls via manifest metadata (cast/receive and optional cull distance).
7. Add production toggles:
- disable verbose telemetry logs by default
- mount `RuntimeTelemetryProbe` only under debug flag (for example `VITE_DEBUG_HUD=1`)
- route nav/manifest warnings into the Scene Issues surface instead of console spam

Target metrics:
1. Significant improvement vs Phase 0 baseline in FPS and frame p95.
2. Lower hotspot ratio and stable frame behavior during interaction-heavy moments.
3. Draw calls remain below warning threshold during full-scene render (including P2 decor).

Deliverables:
1. `reports/client-polish-performance.md` (before/after)

Exit criteria:
1. Runtime is smooth enough for internal demo quality.

## Phase 9: QA Gate and Freeze

Purpose: formal sign-off before backend/service integration.

Tasks:
1. Run full visual QA checklist (`VQA-01` to `VQA-06`) from `docs/visual-qa-checklist.md`.
2. Run:
```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
node contracts/validation/run-validation.mjs
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.md
node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.md
```
3. Run scripted visual QA launcher in both launch modes:
```bash
tools/qa/run-visual-qa.sh --mode both --validate
```
4. Verify offline launch recipe with mock runtime enabled:
```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run dev
```
5. Capture final evidence package.
6. Export deterministic offline session trace artifact:
```bash
OFFICECLAW_NON_PROD=1 node tools/session-trace.mjs export \
  --events <events.jsonl> \
  --commands <commands.jsonl> \
  --out reports/session-trace-polish.json
```
7. Confirm polished offline path produces no blocking console errors and no connection-dead-end microcopy.

Deliverables:
1. `reports/client-polish-qa-gate.md`
2. final screenshots/video
3. known-issues list (if any non-blocking items remain)
4. `reports/session-trace-polish.json`

Exit criteria:
1. Client polish gate approved.
2. Backend integration can start on top of a stable polished client.
3. Contract validation passes and a golden offline trace exists for regression testing.

## Definition of Done (Pre-Backend)

1. Cozy Office background/environment is final-quality (no placeholder look).
2. Scene assembly is manifest-driven and consistent across render/nav/focus/highlight.
3. Runtime systems consume one canonical manifest source/path.
4. POI/object interactions are reliable with smooth walk-to-interact.
5. Offline mode supports realistic panel/action loop without connection dead ends.
6. Performance is measurably improved versus baseline.
7. QA checklist and tooling gates pass with documented evidence.
8. `contracts/` validation passes for scene/protocol fixtures in the release candidate.

## Suggested Execution Order (Calendar View)

1. Week 1:
- Phase 0
- Phase 1
- Phase 2 (sync-first setup + first production asset batch)
2. Week 2:
- Phase 2 (remaining production assets)
- Phase 3
3. Week 3:
- Phase 4
- Phase 5
- Phase 6
4. Week 4:
- Phase 7
- Phase 8
- Phase 9 and freeze

## Risks and Mitigations

1. Risk: Meshy outputs fail clip/style/naming contracts.
- Mitigation: strict work-order + normalization + preflight gate before runtime integration.
2. Risk: Visual polish introduces perf regressions.
- Mitigation: budget checks + telemetry deltas after every asset batch.
3. Risk: Manifest/runtime drift reappears via ad-hoc edits.
- Mitigation: treat `public/**` as generated output and enforce sync workflow.
4. Risk: Manifest migration causes interaction regressions.
- Mitigation: unified runtime bundle + repeat VQA scenarios at each scene milestone.
5. Risk: Offline mode diverges from expected real-world flow.
- Mitigation: gateway-based parity before QA freeze.
6. Risk: Manifest schema evolution breaks content.
- Mitigation: versioned contract in `contracts/` + validation gate + migration notes.
7. Risk: QA pass is hard to reproduce later.
- Mitigation: save session trace, artifacts, and command recipes as regression evidence.
