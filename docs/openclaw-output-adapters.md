# OpenClaw Output Adapters (`bd-2cw`)

Last updated: 2026-02-14

## Scope

Implemented a deterministic adapter pipeline for structured OpenClaw output so run results can mutate world state safely.

Files:
- `apps/server-world/src/openclaw/outputAdapters.mjs`
- `apps/server-world/src/worldState.mjs`
- `apps/server-world/test/simulation.test.mjs`

## Adapter Contract

Runtime event:
- `applyEvent({ name: "openclaw_output_ready", task_id, output })`

Adapter entry:
- `adaptOpenClawStructuredOutput(output)`

Normalized output fields:
- `artifacts[]` -> `{ type, title, poi_id? }`
- `decisions[]` -> `{ prompt, options[] }`
- `follow_up_tasks[]` -> `{ title }`

Guardrails:
- hard caps on item counts
- text normalization and truncation
- strict malformed-output rejection when no actionable content exists

## World-State Mapping

On valid adapted output:
- creates artifact records (`art_oc_####`) linked to source task/project
- creates decision records (`dec_oc_####`) and decision runtime history
- creates follow-up tasks (`task_oc_####`) in `planned`
- marks active run completed (`output_applied`)
- blocks source task if decisions were created; otherwise completes source task

On malformed output:
- marks active run failed (`malformed_output`)
- blocks source task safely
- creates/uses an open fallback decision explaining malformed output
- avoids partial artifact/task corruption

## Validation

```bash
npm --prefix apps/server-world test
```
