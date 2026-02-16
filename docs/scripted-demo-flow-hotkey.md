# Scripted Demo Flow Hotkey

Related bead: `bd-2w3r`

## Purpose

Provide an optional deterministic developer hotkey that runs a repeatable command sequence through gateway-backed dispatch paths for demos and quick sanity checks.

## Enablement

The hotkey is active when either condition is true:
1. `import.meta.env.DEV` (local dev)
2. `VITE_DEMO_FLOW_HOTKEY=1`

## Hotkey

- `Alt+Shift+D` -> run scripted demo flow

Safety behavior:
- If the flow is already running, a notice is shown and a second run is not started.
- Timers are cleaned up on unmount to avoid stale delayed dispatches.

## Deterministic Flow Steps

The flow executes with a fixed inter-step delay (`650ms`) and routes through existing dispatch modules (which in turn call `CommandGateway`):

1. `dispatchSubmitRequest("Demo flow request: validate gateway command loop.")`
2. `dispatchAutoAssign(projectId)` if a project id is available from current world/task/event state
3. `dispatchResolveDecision(decisionId, "Proceed")` if an open decision is available
4. `dispatchApproveArtifact(artifactId)` if a reviewable artifact is available

## Notes

- This feature is optional and isolated from core runtime behavior.
- It is intended for repeatable showcase flow only, not for replacing validation or QA gates.
