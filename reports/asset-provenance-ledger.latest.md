# Asset Provenance Ledger

Generated: 2026-02-16T05:45:34.633Z
Source command: `node tools/asset-provenance-ledger.mjs --out /Users/themrb/Documents/personal/officeclaw/reports/asset-provenance-ledger.latest.md`
Gate mode: `strict`
Require manifests: `yes`

Related beads:
- Epic: `bd-zzou`; credential gate: `bd-dok7`; ledger: `bd-2yns`; provenance gate: `bd-3eoj`
- Generation tracks: env `bd-9hcf`, agent `bd-18j1`

Required production IDs: office_shell, prop_inbox, prop_task_board, prop_delivery_shelf, prop_dev_desk, prop_blocker_cone, agent_base_skeleton, agent_animation_bundle

## Ledger

| asset_id | canonical_path | canonical_sha256 | mirror_path | mirror_sha256 | source_type | evidence_links | gate_blockers | related_br |
|---|---|---|---|---|---|---|---|---|
| `office_shell` | `assets/glb/office_shell.glb` | `993d5a1fec95a0f5a2136cb4e539f0554b1f956946738753f0852f9ce1eed184` | `apps/client-web/public/assets/office_shell.glb` | `993d5a1fec95a0f5a2136cb4e539f0554b1f956946738753f0852f9ce1eed184` | `meshy-live` | `reports/meshy-office_shell-manifest.json` (task_ids: 019c61d2-0aa1-7d90-bf5f-88b6b2546583); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-9hcf`, `bd-2yns`, `bd-3eoj` |
| `prop_inbox` | `assets/glb/inbox.glb` | `30814145e79e154ecab128b29b665c2e94d28788cce2d98fc276fdb342107bac` | `apps/client-web/public/assets/inbox.glb` | `30814145e79e154ecab128b29b665c2e94d28788cce2d98fc276fdb342107bac` | `meshy-live` | `reports/meshy-prop_inbox-manifest.json` (task_ids: 019c61d4-0970-7de9-b7d1-7d5518282563); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-9hcf`, `bd-2yns`, `bd-3eoj` |
| `prop_task_board` | `assets/glb/task_board.glb` | `aed0e43e8a56898a38a4912e81c756a77f587c823024f9871fc45edcacd5b914` | `apps/client-web/public/assets/task_board.glb` | `aed0e43e8a56898a38a4912e81c756a77f587c823024f9871fc45edcacd5b914` | `meshy-live` | `reports/meshy-prop_task_board-manifest.json` (task_ids: 019c61d5-95ae-71b7-ae39-954d5aaab712); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-9hcf`, `bd-2yns`, `bd-3eoj` |
| `prop_delivery_shelf` | `assets/glb/shelf.glb` | `7f07cfa2e4aa437f2eda782cc5b2877d652104ba98a3329b57dc2435f58d2a9a` | `apps/client-web/public/assets/shelf.glb` | `7f07cfa2e4aa437f2eda782cc5b2877d652104ba98a3329b57dc2435f58d2a9a` | `meshy-live` | `reports/meshy-prop_delivery_shelf-manifest.json` (task_ids: 019c61d8-e5ec-7238-b66d-04dc26deb2b1); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-9hcf`, `bd-2yns`, `bd-3eoj` |
| `prop_dev_desk` | `assets/glb/desk.glb` | `17f8bfadfd812827a0829d73136992e587c061788119e88c15ab46753010aa25` | `apps/client-web/public/assets/desk.glb` | `17f8bfadfd812827a0829d73136992e587c061788119e88c15ab46753010aa25` | `meshy-live` | `reports/meshy-prop_dev_desk-manifest.json` (task_ids: 019c61f5-6a05-7cab-9acc-230847f2ec91); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-9hcf`, `bd-2yns`, `bd-3eoj` |
| `prop_blocker_cone` | `assets/glb/blocker_cone.glb` | `3d891c076c5b1fa9e4e0318df70979207117ff748c6e858281da612736009071` | `apps/client-web/public/assets/blocker_cone.glb` | `3d891c076c5b1fa9e4e0318df70979207117ff748c6e858281da612736009071` | `meshy-live` | `reports/meshy-prop_blocker_cone-manifest.json` (task_ids: 019c6215-12a5-792a-9f53-03c2ece0f1cb); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-9hcf`, `bd-2yns`, `bd-3eoj` |
| `agent_base_skeleton` | `assets/glb/agent1_skeleton.glb` | `d0ff59bfd1587a4a2a9283b9117a4522b400e85b546fe00b9c548571930a57c2` | `apps/client-web/public/assets/agent1_skeleton.glb` | `d0ff59bfd1587a4a2a9283b9117a4522b400e85b546fe00b9c548571930a57c2` | `meshy-live` | `reports/meshy-agent_base_skeleton-manifest.json` (task_ids: 019c6223-3128-7be7-bed7-a80f9af5491a, 019c6224-b964-7c2e-a4c4-f6bebb2aa7ad); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-18j1`, `bd-2yns`, `bd-3eoj` |
| `agent_animation_bundle` | `assets/glb/agent1_animations.glb` | `ad91f14e4fe71dfb995719a4294beaf9bd4d80315a29419f076c59acd3a63f81` | `apps/client-web/public/assets/agent1_animations.glb` | `ad91f14e4fe71dfb995719a4294beaf9bd4d80315a29419f076c59acd3a63f81` | `meshy-live` | `reports/meshy-agent_animation_bundle-manifest.json` (task_ids: 019c6223-3128-7be7-bed7-a80f9af5491a, 019c6224-b964-7c2e-a4c4-f6bebb2aa7ad, 019c6227-1d24-76dd-b90d-cb11a7551279, 019c6227-74df-7cdb-b9ab-41cac59e792e, 019c6228-0a81-7d15-8581-2416a22cda66, 019c6228-f20f-7c75-9071-357f4999fe7c, 019c6229-b0f0-7c8d-8250-b416254d6059); `reports/asset-budget-summary.md`; `reports/meshy-credential-check.bd-dok7.md` | none | `bd-18j1`, `bd-2yns`, `bd-3eoj` |

## Placeholder Hash Audit

No shared SHA256 hash clusters detected across required production assets.

## Gate Blockers

No blockers detected.

## Remediation

1. Generate live Meshy outputs for missing evidence:
   - `python3 tools/meshy_pipeline.py --image <path> --asset-id <id> --output-dir assets/glb --manifest-out reports/meshy-<asset_id>-manifest.json`
2. Replace hash-reused/tiny placeholder assets with unique production GLBs.
3. Resync runtime mirror copies:
   - `node tools/sync-runtime-assets.mjs`
4. Re-run strict gate:
   - `node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md`

## Traceability

- `reports/p2r-kickoff.bd-zzou.md`
- `reports/meshy-credential-check.bd-dok7.md`
- `reports/asset-budget-summary.md`
- `reports/asset-provenance-ledger.bd-2yns.md`
- `reports/meshy-provenance-gate.bd-3eoj.md`
