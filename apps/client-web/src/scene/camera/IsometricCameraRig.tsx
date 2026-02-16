import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type OrthographicCamera, Vector3 } from "three";
import { useUiStore } from "../../state/uiStore";
import { useSceneRuntimeProvider } from "../runtime";

const DEFAULT_CAMERA_POSITION = new Vector3(12, 12, 12);
const DEFAULT_LOOK_AT = new Vector3(0, 0, 0);
const FRUSTUM_HEIGHT = 24;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.0015;
const CAMERA_LERP_PER_SECOND = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function IsometricCameraRig() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const sceneRuntime = useSceneRuntimeProvider();

  const focusedPoiId = useUiStore((state) => state.focusedPoiId);
  const setFocusedPoiScreenAnchor = useUiStore((state) => state.setFocusedPoiScreenAnchor);

  const orthographicCamera = useMemo(() => camera as OrthographicCamera, [camera]);
  const lookAtRef = useRef(DEFAULT_LOOK_AT.clone());
  const targetPositionRef = useRef(DEFAULT_CAMERA_POSITION.clone());
  const targetLookAtRef = useRef(DEFAULT_LOOK_AT.clone());
  const targetZoomRef = useRef(1.1);
  const preFocusZoomRef = useRef<number | null>(null);
  const lastFocusedPoiRef = useRef<string | null>(null);
  const lastProjectedAnchorRef = useRef<{ x: number; y: number } | null>(null);

  const poiFocusConfigById = sceneRuntime.snapshot.derived?.poiFocusConfigById ?? {};

  useEffect(() => {
    if (!orthographicCamera.isOrthographicCamera) {
      return;
    }

    orthographicCamera.position.copy(DEFAULT_CAMERA_POSITION);
    lookAtRef.current.copy(DEFAULT_LOOK_AT);
    targetPositionRef.current.copy(DEFAULT_CAMERA_POSITION);
    targetLookAtRef.current.copy(DEFAULT_LOOK_AT);
    targetZoomRef.current = clamp(orthographicCamera.zoom, MIN_ZOOM, MAX_ZOOM);

    orthographicCamera.lookAt(lookAtRef.current);
    orthographicCamera.zoom = targetZoomRef.current;
    orthographicCamera.updateProjectionMatrix();
  }, [orthographicCamera]);

  useEffect(() => {
    if (!orthographicCamera.isOrthographicCamera || size.height === 0) {
      return;
    }

    const halfHeight = FRUSTUM_HEIGHT / 2;
    const halfWidth = halfHeight * (size.width / size.height);

    orthographicCamera.left = -halfWidth;
    orthographicCamera.right = halfWidth;
    orthographicCamera.top = halfHeight;
    orthographicCamera.bottom = -halfHeight;
    orthographicCamera.updateProjectionMatrix();
  }, [orthographicCamera, size.height, size.width]);

  useEffect(() => {
    if (!orthographicCamera.isOrthographicCamera) {
      return;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const nextZoom = clamp(
        targetZoomRef.current - event.deltaY * ZOOM_STEP,
        MIN_ZOOM,
        MAX_ZOOM
      );
      targetZoomRef.current = nextZoom;
      if (!focusedPoiId) {
        preFocusZoomRef.current = nextZoom;
      }
    }

    gl.domElement.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      gl.domElement.removeEventListener("wheel", onWheel);
    };
  }, [focusedPoiId, gl.domElement, orthographicCamera]);

  useEffect(() => {
    const focusConfig = focusedPoiId ? poiFocusConfigById[focusedPoiId] : undefined;

    if (focusConfig) {
      if (!lastFocusedPoiRef.current) {
        preFocusZoomRef.current = targetZoomRef.current;
      }

      targetLookAtRef.current.set(...focusConfig.focusPoint);
      targetPositionRef.current
        .copy(targetLookAtRef.current)
        .add(new Vector3(...focusConfig.cameraOffset));

      const baseZoom = preFocusZoomRef.current ?? targetZoomRef.current;
      targetZoomRef.current = clamp(
        baseZoom * focusConfig.zoomMultiplier,
        MIN_ZOOM,
        MAX_ZOOM
      );
      lastFocusedPoiRef.current = focusedPoiId;
      return;
    }

    targetLookAtRef.current.copy(DEFAULT_LOOK_AT);
    targetPositionRef.current.copy(DEFAULT_CAMERA_POSITION);

    const restoreZoom = preFocusZoomRef.current ?? targetZoomRef.current;
    targetZoomRef.current = clamp(restoreZoom, MIN_ZOOM, MAX_ZOOM);
    preFocusZoomRef.current = null;
    lastFocusedPoiRef.current = null;
    setFocusedPoiScreenAnchor(null);
    lastProjectedAnchorRef.current = null;
  }, [focusedPoiId, poiFocusConfigById, setFocusedPoiScreenAnchor]);

  useFrame((_state, delta) => {
    if (!orthographicCamera.isOrthographicCamera) {
      return;
    }

    const alpha = Math.min(1, delta * CAMERA_LERP_PER_SECOND);
    orthographicCamera.position.lerp(targetPositionRef.current, alpha);
    lookAtRef.current.lerp(targetLookAtRef.current, alpha);
    orthographicCamera.lookAt(lookAtRef.current);

    const nextZoom = clamp(
      orthographicCamera.zoom + (targetZoomRef.current - orthographicCamera.zoom) * alpha,
      MIN_ZOOM,
      MAX_ZOOM
    );
    if (Math.abs(nextZoom - orthographicCamera.zoom) > 0.0001) {
      orthographicCamera.zoom = nextZoom;
      orthographicCamera.updateProjectionMatrix();
    }

    if (focusedPoiId) {
      const focusConfig = poiFocusConfigById[focusedPoiId];
      if (focusConfig) {
        const anchorWorld = new Vector3(...focusConfig.panelAnchor);
        const projected = anchorWorld.project(orthographicCamera);
        const x = (projected.x * 0.5 + 0.5) * size.width;
        const y = (-projected.y * 0.5 + 0.5) * size.height;

        const last = lastProjectedAnchorRef.current;
        if (!last || Math.abs(last.x - x) > 0.5 || Math.abs(last.y - y) > 0.5) {
          const nextAnchor = { x, y };
          lastProjectedAnchorRef.current = nextAnchor;
          setFocusedPoiScreenAnchor(nextAnchor);
        }
      }
      return;
    }

    if (lastProjectedAnchorRef.current) {
      lastProjectedAnchorRef.current = null;
      setFocusedPoiScreenAnchor(null);
    }
  });

  return null;
}
