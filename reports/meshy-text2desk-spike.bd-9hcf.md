# Meshy Text-to-3D Dev Desk Spike (`bd-9hcf`)

Date: 2026-02-15  
Agent: HazyEagle  
Scope: User-directed spike to test Meshy text-to-3d for `prop_dev_desk` and preview in runtime.

## Commands Run

### 1) Generate desk via Meshy text-to-3d
Executed a direct API flow against:
- `POST /openapi/v2/text-to-3d` with `mode=preview`
- Poll until terminal status
- Download GLB artifact

Manifest:
- `reports/meshy-prop_dev_desk-text-manifest.json`

Task:
- endpoint: `/openapi/v2/text-to-3d`
- task id: `019c61f5-6a05-7cab-9acc-230847f2ec91`

Output:
- `assets/glb/prop_dev_desk_text_generated.glb`

### 2) Runtime swap for in-game check
- Backed up previous canonical desk:
  - `assets/glb/desk.pre_text2desk_20260215T154142Z.glb`
- Replaced canonical runtime source:
  - `assets/glb/desk.glb` (copied from generated text-to-3d GLB)
- Synced runtime assets:
  - `npm --prefix apps/client-web run assets:sync`
  - logs: `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/assets-sync.stdout.txt`

### 3) In-game capture attempt (agent-browser)
Runtime launch:
- `VITE_OFFLINE_MOCK_WORLD=1 VITE_WORLD_WS_AUTO_CONNECT=0 VITE_SCENE_ID=cozy_office_v0 npm --prefix apps/client-web run dev -- --host 127.0.0.1 --port 4190`

Capture artifacts:
- `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/desk-render-default-view.png`
- `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/desk-render-inbox-focus.png`
- `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/desk-render-after-long-wait.png`
- console/errors:
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/browser-console.txt`
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/browser-errors.txt`
- runtime snapshot text:
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/startup-assets-text.txt`
  - observed: `Startup assets: 0/0 loaded=0 failed=0`

## Outcome
- Meshy text-to-3d generation for dev desk succeeded.
- `desk.glb` is now replaced with generated desk output for local spike validation.
- In-game visual verification is currently inconclusive in this run because scene capture showed startup asset telemetry `0/0` (no reliable rendered desk visibility in captured frames).

## Retry Check
- Triggered `Reload Scene Runtime` in a second `agent-browser` session and re-captured.
- Telemetry remained:
  - `Startup assets: 0/0 loaded=0 failed=0`
- Retry artifacts:
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/reload-startup-assets-text.txt`
  - `reports/client-polish/meshy/bd-9hcf-textdesk/20260215T154142Z/desk-render-after-reload-click.png`

## Hash Evidence
- `assets/glb/prop_dev_desk_text_generated.glb`
  - `17f8bfadfd812827a0829d73136992e587c061788119e88c15ab46753010aa25`
- `assets/glb/desk.glb`
  - `17f8bfadfd812827a0829d73136992e587c061788119e88c15ab46753010aa25`

## Notes
- This was a focused spike; `bd-9hcf` remains blocked for full curated reference-image workflow.
