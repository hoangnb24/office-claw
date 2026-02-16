# office-claw

Contributor start:
- Read `AGENTS.md`
- Read `CONTRIBUTOR_ONBOARDING.md`

Asset URL policy:
- Canonical runtime URLs are root-served: `/assets/<file>.glb`.
- Treat `/assets/props/*` and `/assets/agents/*` as legacy historical paths only.
- Current Sprint A canonical examples: `/assets/inbox.glb`, `/assets/task_board.glb`, `/assets/shelf.glb`, `/assets/desk.glb`, `/assets/blocker_cone.glb`, `/assets/agent1_skeleton.glb`, `/assets/agent1_animations.glb`.

Meshy work-order wrapper:
- Build a portable, repo-relative work order:
```bash
node tools/meshy-work-order.mjs \
  --asset-id agent1 \
  --image images/agent_front.jpeg \
  --image images/agent_back.jpeg
```
- Default output: `reports/meshy-work-order-agent1.md`

Asset provenance ledger:
- Generate deterministic hash/source audit for required production GLBs:
```bash
node tools/asset-provenance-ledger.mjs
```
- Default output: `reports/asset-provenance-ledger.md`
- Enforce strict gate (non-zero exit on blockers/missing manifests):
```bash
node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md
```
