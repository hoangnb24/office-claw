# GLB Preflight Warning Disposition (bd-24s)

Reviewed: 2026-02-15T12:51:20Z
Source report: `reports/glb-preflight-report.bd-24s.md`

## Summary

- Blocking errors: `0`
- Warnings reviewed: `4`
- Disposition status: `accepted-with-followup`

## Warning Review

1. `assets/glb/agent1_animations.glb` (`scale`)
Disposition: Accept for current P0/P1 integration.
Rationale: Runtime playback and manifest validation pass; warning reflects authoring scale convention from current export chain.
Follow-up: Re-normalize transform in DCC/export pipeline during asset optimization phase.

2. `assets/glb/agent1_skeleton.glb` (`scale`)
Disposition: Accept for current integration.
Rationale: Skeleton is consumed with existing runtime scale expectations and does not produce preflight errors.
Follow-up: Normalize armature/object scale when skeleton/rig is next regenerated.

3. `assets/glb/desk.glb` (`scale`)
Disposition: Accept temporarily.
Rationale: Scene placement and navigation behavior remain correct after sync and nav checks.
Follow-up: Normalize source object scale before next geometry compression batch.

4. `assets/glb/shelf.glb` (`scale`)
Disposition: Accept temporarily.
Rationale: Interaction anchors and collider alignment are currently stable.
Follow-up: Normalize scale in the same export pass as `desk.glb` to keep environment asset conventions consistent.

## Commands Run

```bash
node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --dry-run
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.bd-24s.md
node tools/qa/run-qa-gates.mjs --only preflight
```
