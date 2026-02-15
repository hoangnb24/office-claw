# Isometric Camera Rig (bd-375)

`apps/client-web/src/scene/camera/IsometricCameraRig.tsx` implements the v0 camera contract:

- fixed-angle orthographic camera
- bounded zoom (`MIN_ZOOM`/`MAX_ZOOM`)
- projection updates on viewport resize

## Behavior

- The rig assumes `Canvas` is orthographic and keeps camera position fixed at an isometric angle.
- Wheel input adjusts `camera.zoom` within bounds.
- On resize, frustum edges (`left/right/top/bottom`) are recomputed from a constant world-space frustum height to preserve composition.

## Integration

- `apps/client-web/src/App.tsx` sets the R3F canvas to `orthographic`.
- `apps/client-web/src/scene/OfficeScene.tsx` mounts `IsometricCameraRig` once per scene.
