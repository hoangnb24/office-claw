# Client Asset and Runtime Budget Matrix (`bd-2hs`)

Last updated: 2026-02-15

This matrix defines explicit P0/P1/P2 limits for client polish so asset intake and runtime acceptance are deterministic.

## Tier Definitions

- `P0` critical: must-pass assets/flows for baseline demo path (office shell, core interactables, primary agent).
- `P1` important: near-path assets and quality enhancers that should remain stable under normal interaction.
- `P2` optional/backdrop: decor and non-critical detail assets.

## Scene-Level Runtime Budgets

Values are evaluated during representative baseline scenarios (idle + interaction-heavy).

| Metric | P0 Target | P1 Target | P2 Max (hard cap) | Source |
|---|---|---|---|---|
| FPS | `>= 45` | `>= 35` | `>= 30` | Debug HUD (`RuntimeTelemetryProbe`) |
| Frame p95 (ms) | `<= 20` | `<= 26` | `<= 28` | Debug HUD |
| Hotspot rate (%) | `<= 10` | `<= 15` | `<= 18` | Debug HUD (`>20ms` frames) |
| Draw calls | `<= 300` | `<= 420` | `<= 500` | Debug HUD / `gl.info.render.calls` |
| Triangles | `<= 300,000` | `<= 420,000` | `<= 500,000` | Debug HUD / `gl.info.render.triangles` |

Notes:
- P2 hard caps align with current runtime warning thresholds in `apps/client-web/src/scene/debug/RuntimeTelemetryProbe.tsx`.
- Any cap breach is treated as a budget failure unless an approved exception exists.

## Per-Asset Budgets

| Budget Dimension | P0 | P1 | P2 | Check Method |
|---|---|---|---|---|
| Triangles per asset | `<= 75,000` | `<= 30,000` | `<= 12,000` | DCC export stats + preflight review |
| Materials per asset | `<= 6` | `<= 3` | `<= 2` | GLB inspection/preflight notes |
| Max texture dimension | `2048` | `1024` | `512` | Texture import metadata |
| Shadow casters per asset | `<= 6` | `<= 3` | `<= 1` | `sceneAssetCatalog.renderBudget` |
| Shadow receivers per asset | `<= 8` | `<= 4` | `<= 2` | `sceneAssetCatalog.renderBudget` |

## Exception Process

Use an exception only when a measurable UX benefit outweighs budget risk.

Required fields (store in `reports/asset-budget-summary.md`):
1. Asset id/path and tier.
2. Which limit is exceeded and by how much.
3. Why lower-cost alternative is insufficient.
4. Mitigation plan (LOD, instancing, texture compression, shadow reduction, etc.).
5. Owner and expiration milestone (must not be open-ended).

Approval rule:
- Requires explicit sign-off from one engineering owner and one product/design owner.

## Acceptance Checks

These gates must reference this matrix and record pass/fail against limits:

1. Runtime telemetry capture (idle + interaction-heavy):
```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run dev
```
Record FPS/p95/hotspot/draw/triangles in baseline/perf reports and compare with table thresholds.

2. Contract and preflight checks:
```bash
node contracts/validation/run-validation.mjs
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.md
```

3. Budget audit report:
- Update `reports/asset-budget-summary.md` with per-asset tier, measured values, and exceptions.

## Pass/Fail Policy

- `Pass`: all required assets/flows are within tier limits and no unapproved exceptions exist.
- `Conditional pass`: only approved exceptions remain, each with owner + expiration milestone.
- `Fail`: any P2 hard-cap breach or missing exception record.
