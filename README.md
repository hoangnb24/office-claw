# office-claw

OfficeClaw is a collaborative office simulation runtime with an authoritative world server, a 3D web client, contract validation gates, and deterministic QA/asset tooling.

## Start Here

- Read `AGENTS.md`.
- Read `CONTRIBUTOR_ONBOARDING.md`.

## Runtime Architecture

- `apps/server-world`: authoritative simulation and protocol server for `/ws/world`.
- `apps/client-web`: React + Three.js runtime, overlays, offline mock runtime, and websocket client.
- `contracts`: JSON schemas, fixtures, and invariant validators.
- `packages/openclaw-gateway`: OpenClaw gateway contract tests.
- `packages/repository`: repository adapter tests.
- `tools`: QA gates, asset sync/preflight/provenance, navigation checks, trace export/import.

Authoritative server runtime modules:

- `apps/server-world/src/worldServer.mjs`
- `apps/server-world/src/commandRouter.mjs`
- `apps/server-world/src/worldState.mjs`

## Runtime Asset URL Policy

Canonical runtime URLs are root-served:

- `/assets/<file>.glb`

Canonical examples:

- `/assets/inbox.glb`
- `/assets/task_board.glb`
- `/assets/shelf.glb`
- `/assets/desk.glb`
- `/assets/blocker_cone.glb`
- `/assets/agent1_skeleton.glb`
- `/assets/agent1_animations.glb`

## Setup

Install dependencies per workspace:

```bash
npm --prefix apps/client-web install
npm --prefix apps/server-world install
npm --prefix contracts install
npm --prefix packages/openclaw-gateway install
npm --prefix packages/repository install
```

## Run Profiles

Client-only offline mock runtime:

```bash
VITE_OFFLINE_MOCK_WORLD=1 npm --prefix apps/client-web run dev
```

Client against local live world server:

Terminal A:

```bash
node --input-type=module - <<'EOF_SERVER'
import { createWorldServer } from "./apps/server-world/src/index.mjs";

const server = createWorldServer({
  host: "127.0.0.1",
  port: 8787,
  commandJournalPath: "./reports/runtime/commands.jsonl",
  eventLogPath: "./reports/runtime/events.jsonl"
});

const info = await server.start();
console.log(`[server-world] ws://${info.host}:${info.port}/ws/world`);
console.log("[server-world] health: http://127.0.0.1:8787/health");

await new Promise(() => {});
EOF_SERVER
```

Terminal B:

```bash
VITE_WORLD_WS_URL=ws://127.0.0.1:8787/ws/world npm --prefix apps/client-web run dev
```

## Workspace Commands

`apps/client-web`:

```bash
npm --prefix apps/client-web run dev
npm --prefix apps/client-web run build
npm --prefix apps/client-web run preview
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run assets:sync
npm --prefix apps/client-web run assets:sync:prune
npm --prefix apps/client-web run assets:verify
```

`apps/server-world`:

```bash
npm --prefix apps/server-world test
```

`contracts`:

```bash
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```

`packages/openclaw-gateway` and `packages/repository`:

```bash
npm --prefix packages/openclaw-gateway test
npm --prefix packages/repository test
```

## QA and Contract Gates

Full QA gate runner:

```bash
node tools/qa/run-qa-gates.mjs
```

Grouped execution:

```bash
node tools/qa/run-qa-gates.mjs --only client
node tools/qa/run-qa-gates.mjs --only contracts
node tools/qa/run-qa-gates.mjs --only preflight
node tools/qa/run-qa-gates.mjs --only parity
node tools/qa/run-qa-gates.mjs --only client,contracts --dry-run
```

Offline/live parity regression guard:

```bash
node tools/qa/check-offline-live-parity.mjs
```

Visual QA launch helper and baseline capture:

```bash
tools/qa/run-visual-qa.sh --mode both --validate
node tools/qa/capture-baseline-visuals.mjs --out-dir reports/client-polish/baseline/manual
node tools/qa/capture-baseline-visuals.mjs --out-dir reports/client-polish/baseline/scene-only --scene-only
```

## Asset and Scene Tooling

Sync canonical assets into runtime-served directories:

```bash
node tools/sync-runtime-assets.mjs
node tools/sync-runtime-assets.mjs --check
node tools/sync-runtime-assets.mjs --check --verbose
node tools/sync-runtime-assets.mjs --prune
```

Asset provenance ledger and strict gate:

```bash
node tools/asset-provenance-ledger.mjs
node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md
```

Navigation and GLB preflight:

```bash
node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.md
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md
```

Clip normalization and compression:

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --preset meshy-agent-v0
node tools/compress-runtime-assets.mjs --texture-mode auto --report reports/asset-budget-summary.md
```

Meshy work-order wrapper:

```bash
node tools/meshy-work-order.mjs --asset-id agent1 --image images/agent_front.jpeg --image images/agent_back.jpeg
```

### Command Option Reference

`tools/sync-runtime-assets.mjs`:

- `--source-glb <path>`
- `--source-scenes <path>`
- `--target-assets <path>`
- `--target-scenes <path>`
- `--check`
- `--prune`
- `--verbose`

`tools/asset-provenance-ledger.mjs`:

- `--out <path>`
- `--strict`
- `--require-manifests`
- `--tiny-threshold <bytes>`

`tools/qa/run-qa-gates.mjs`:

- `--only <all|client|contracts|preflight|parity>`
- `--dry-run`

`tools/nav-preflight.mjs`:

- `--scene <path>`
- `--out <path>` (alias: `--report`)

`tools/glb-preflight.mjs`:

- `--scene <path>`
- `--asset-root <path>`
- `--report <path>`

`tools/glb-normalize-clips.mjs`:

- `--in <path>`
- `--out <path>`
- `--preset <name>`
- `--dry-run`
- `--allow-missing`

`tools/compress-runtime-assets.mjs`:

- `--input-root <path>`
- `--output-root <path>`
- `--assets <csv>`
- `--texture-mode <auto|webp|ktx2|none>`
- `--report <path>`
- `--dry-run`

`tools/qa/capture-baseline-visuals.mjs`:

- `--base-url <url>`
- `--out-dir <path>`
- `--timeout-ms <ms>`
- `--scene-only`

`tools/qa/run-visual-qa.sh`:

- `--mode online|offline|both`
- `--validate`

## Session Trace Utilities

Export/import world session traces with non-production guardrails:

```bash
OFFICECLAW_NON_PROD=1 node tools/session-trace.mjs export \
  --events reports/runtime/events.jsonl \
  --commands reports/runtime/commands.jsonl \
  --out reports/runtime/session-trace.json

OFFICECLAW_NON_PROD=1 node tools/session-trace.mjs import \
  --in reports/runtime/session-trace.json \
  --events-out reports/runtime/events.import.jsonl \
  --commands-out reports/runtime/commands.import.jsonl \
  --allow-overwrite
```

## Reference Docs

- `PROTOCOL.md`
- `SCENE_MANIFESTS.md`
- `POI_AND_INTERACTIONS.md`
- `COMMAND_TAXONOMY.md`
- `docs/qa-gate-command-suite.md`
- `docs/contracts-validation-gates.md`
- `docs/operations-runbook.md`
