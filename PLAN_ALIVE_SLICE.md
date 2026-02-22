# OfficeClaw Alive Slice Plan (No Audio)
Version: 2026-02-22

## Summary
This plan upgrades OfficeClaw from placeholder-feeling scene composition to a playable, visually alive vertical slice using existing GLB inventory plus targeted generation via the Meshy pipeline and skills. Audio is explicitly out of scope for this phase.

Primary objective:
- Make the office feel alive through character animation, motion rhythm, lighting/material polish, interaction feedback (visual only), and contract-safe asset integration.

Constraints selected:
- Vertical slice first (single scene, high polish).
- Character/animation first priority.
- Hybrid asset strategy (existing + generated + selective replacements).
- Desktop + mobile early support.
- No audio work in this phase.

---

## Scope

### In Scope
- Asset curation and canonical runtime lock.
- Missing GLB generation using existing pipeline.
- Agent animation contract enforcement and runtime blending polish.
- Scene manifest/hook alignment (POI, highlight nodes, nav anchors).
- Lighting/material/environment polish for alive feel.
- Visual-only feedback cues tied to world events.
- QA/perf/provenance gate compliance.

### Out of Scope
- Sound/music/SFX implementation.
- Multi-scene expansion.
- New protocol major version changes.
- Backend model changes unrelated to presentation and interaction feel.

---

## Current Known Gaps (from repo state)
1. Multiple GLB variants exist; canonical runtime winners are not fully locked.
2. Preflight inconsistency: `reports/glb-preflight-report.current.md` includes blocking error:
   - Missing highlight node `DeskTop`.
3. Scene feels system-complete but presentation-light:
   - Limited visual feedback richness.
   - Lighting/material mood not fully defining “alive” quality.
4. Character runtime loop needs stronger “life” expression:
   - state-driven animation switching quality, variety timing, transition smoothness.

---

## Phase Plan

## Phase 0 — Freeze Asset Contract (Decision Lock)
Goal: eliminate ambiguity about which assets are authoritative for runtime.

Steps:
1. Build runtime winner table (one file per role):
   - `office_shell`, `inbox`, `task_board`, `shelf`, `desk`, `blocker_cone`, `agent1_skeleton`, `agent1_animations`.
2. Mark all alternates (`*_generated`, `*.pre_*`) as staging/non-runtime unless explicitly promoted.
3. Ensure scene manifest references only locked winners with root-served URLs:
   - `/assets/<file>.glb`.

Deliverables:
- Asset lock matrix in docs (`docs/` update in implementation phase).
- Clean runtime mapping for `assets/glb` -> `apps/client-web/public/assets`.

Acceptance:
- No runtime references to non-locked variants.
- `assets:verify` passes.

---

## Phase 1 — Generate Missing/Replacement GLBs (Pipeline + Skill)
Goal: fill only true gaps after lock, not regenerate everything.

Generation workflow per asset:
1. Work order:
   - `node tools/meshy-work-order.mjs --asset-id <id> --image <img1> [--image <img2> ...]`
2. Generate:
   - `python3 tools/meshy_pipeline.py --image <img> ... --asset-id <id> --output-dir assets/glb --manifest-out reports/meshy-<id>-manifest.json`
3. For character animation packs:
   - normalize clips:
     - `node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb`
4. Validate:
   - `node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md`
   - provenance:
     - `node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.latest.md`

Deliverables:
- Replacement GLBs only where needed.
- Manifest evidence for generated assets in `reports/meshy-*-manifest.json`.

Acceptance:
- No preflight `ERROR`.
- Strict provenance gate passes.

---

## Phase 2 — Fix Manifest Hook Integrity
Goal: remove all scene->asset integration blockers.

Required fix from current reports:
- Resolve `DeskTop` highlight mismatch by one of:
1. Add/rename GLB node to `DeskTop` (preferred if semantically correct), or
2. Update `highlight_nodes` in `assets/scenes/cozy_office_v0.scene.json` to actual node name.

Then validate nav/path hooks:
- `node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.latest.md`

Deliverables:
- Scene manifest and model node names in sync.
- Anchor reachability and highlight hooks valid.

Acceptance:
- `glb-preflight` has zero `ERROR`.
- `nav-preflight` passes with zero blocking issues.

---

## Phase 3 — Character Life Loop Polish (No Audio)
Goal: make agents feel alive through animation and behavior coherence.

Implementation targets:
1. Strengthen state->clip mapping (`Idle`, `Walk`, `Work_Typing`, `Think`, optional `Carry`).
2. Crossfade policy:
   - default 80–150ms fades,
   - interruption-safe transition rules.
3. Add low-cost variation:
   - idle phase offsets,
   - micro timing jitter,
   - non-synchronized starts for multi-agent scenes.
4. Preserve deterministic behavior for offline/live parity.

Acceptance:
- Visible smooth transitions across task states.
- Multiple agents no longer appear mechanically synchronized.
- Offline/live parity checks remain green.

---

## Phase 4 — Environment “Alive” Pass (Visual-Only)
Goal: remove placeholder feel through lighting/material/environment motion.

Implementation targets:
1. Lighting profile for cozy office (desktop high + mobile fallback).
2. Hero material polish order:
   - desk, task board, inbox, shelf, office shell.
3. Subtle visual ambience:
   - low-cost environmental motion/FX (no audio).
4. Keep performance budgets tiered.

Acceptance:
- Scene readability and mood significantly improved.
- No perf regressions beyond thresholds by tier.

---

## Phase 5 — Visual Feedback Cues (Event-Driven, No Audio)
Goal: reinforce interactivity and world change visibility.

Add visual-only cues for:
- task assignment,
- decision resolution,
- artifact approval/changes requested,
- key POI interactions.

Constraints:
- cues must be brief, non-intrusive, and mobile-safe.
- all cues must respect existing UI/state architecture.

Acceptance:
- Every critical command outcome has a visible confirmation.
- No dead-end interaction states.

---

## Phase 6 — Performance & Gate Hardening
Goal: keep quality with desktop+mobile viability.

Required checks:
1. Sync/verify assets:
   - `npm --prefix apps/client-web run assets:sync`
   - `npm --prefix apps/client-web run assets:verify`
2. Full QA:
   - `node tools/qa/run-qa-gates.mjs`
3. Load/perf:
   - `node tools/load/world-server-benchmark.mjs --out reports/world-server-benchmark.latest.json`
   - `node tools/load/check-world-server-benchmark-thresholds.mjs --in reports/world-server-benchmark.latest.json`
4. Visual baseline refresh:
   - `node tools/qa/capture-baseline-visuals.mjs ...`

Acceptance:
- All selected QA gates pass.
- Benchmark thresholds pass for chosen profile limits.

---

## Public Interfaces / Contracts (Additive Only)
Planned interface changes are optional/additive only:
1. Scene manifest optional presentation fields (if needed during implementation):
   - `lighting_profile`, `ambience_profile`, `fx_anchors`.
2. Runtime quality profile flags:
   - shadow tier, FX density, cull distance bands.
3. No breaking envelope/command changes; no protocol major bump.

---

## Test Cases and Scenarios
1. Contract tests:
   - scene manifest validation with updated hooks.
2. Preflight tests:
   - GLB preflight zero `ERROR`.
   - nav preflight zero blocking issues.
3. Runtime behavior tests:
   - animation transitions across state changes.
   - multiple agents with non-synchronized idle cadence.
4. Parity tests:
   - offline/live command + microcopy parity remains passing.
5. Performance tests:
   - desktop and mobile profile thresholds remain within targets.
6. Visual QA:
   - baseline captures confirm improved alive feel without regressions.

---

## Definition of Done
The slice is “alive-ready” when all are true:
1. Canonical runtime assets are locked and validated.
2. No preflight blocking errors.
3. Character animation transitions feel smooth and state-correct.
4. Scene mood and visual feedback materially improve perceived liveliness.
5. QA/perf/provenance gates pass.
6. No audio dependency exists for acceptance.

---

## Assumptions and Defaults
1. Audio remains out of scope.
2. Existing server authoritative model remains unchanged.
3. Existing GLB inventory is sufficient baseline; generation is targeted only for true gaps.
4. Additive-only contract strategy is maintained.
5. Mobile compatibility is achieved through quality tiers, not separate assets by default.
