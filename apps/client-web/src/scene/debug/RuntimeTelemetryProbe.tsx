import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useWorldStore } from "../../state/worldStore";

const SAMPLE_WINDOW = 180;
const PUBLISH_INTERVAL_SECONDS = 0.25;
const HOTSPOT_FRAME_THRESHOLD_MS = 20;
const PERF_WARNING_THRESHOLDS = Object.freeze({
  minFps: 30,
  maxFrameP95Ms: 28,
  maxHotspotPercent: 18,
  maxDrawCalls: 500,
  maxTriangles: 500_000,
  criticalFps: 20,
  criticalFrameP95Ms: 45,
  criticalHotspotPercent: 30
});

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

export function RuntimeTelemetryProbe() {
  const frameMsWindowRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);
  const sampleCountRef = useRef(0);
  const hotspotCountRef = useRef(0);

  useFrame((frameState, delta) => {
    const frameMs = delta * 1000;
    sampleCountRef.current += 1;
    if (frameMs >= HOTSPOT_FRAME_THRESHOLD_MS) {
      hotspotCountRef.current += 1;
    }

    const frameWindow = frameMsWindowRef.current;
    frameWindow.push(frameMs);
    if (frameWindow.length > SAMPLE_WINDOW) {
      frameWindow.shift();
    }

    elapsedRef.current += delta;
    if (elapsedRef.current < PUBLISH_INTERVAL_SECONDS) {
      return;
    }

    const frameAvgMs = average(frameWindow);
    const frameP95Ms = percentile(frameWindow, 0.95);
    const fps = frameAvgMs > 0 ? 1000 / frameAvgMs : null;
    const hotspotPercent =
      sampleCountRef.current > 0 ? (hotspotCountRef.current / sampleCountRef.current) * 100 : 0;
    const renderInfo = frameState.gl.info.render;
    const roundedFps = fps === null ? null : Number(fps.toFixed(1));
    const roundedP95 = frameP95Ms > 0 ? Number(frameP95Ms.toFixed(2)) : null;
    const roundedHotspotPercent = Number(hotspotPercent.toFixed(1));

    const perfAlerts: string[] = [];
    if (roundedFps !== null && roundedFps < PERF_WARNING_THRESHOLDS.minFps) {
      perfAlerts.push("fps_low");
    }
    if (roundedP95 !== null && roundedP95 > PERF_WARNING_THRESHOLDS.maxFrameP95Ms) {
      perfAlerts.push("frame_p95_high");
    }
    if (roundedHotspotPercent > PERF_WARNING_THRESHOLDS.maxHotspotPercent) {
      perfAlerts.push("frame_hotspots_high");
    }
    if (renderInfo.calls > PERF_WARNING_THRESHOLDS.maxDrawCalls) {
      perfAlerts.push("draw_calls_high");
    }
    if (renderInfo.triangles > PERF_WARNING_THRESHOLDS.maxTriangles) {
      perfAlerts.push("triangles_high");
    }

    const criticalPerfAlert =
      (roundedFps !== null && roundedFps < PERF_WARNING_THRESHOLDS.criticalFps) ||
      (roundedP95 !== null && roundedP95 > PERF_WARNING_THRESHOLDS.criticalFrameP95Ms) ||
      roundedHotspotPercent > PERF_WARNING_THRESHOLDS.criticalHotspotPercent;
    const alertLevel =
      perfAlerts.length === 0 ? "healthy" : criticalPerfAlert ? "critical" : "warning";

    useWorldStore.getState().setRuntimePerf({
      fps: roundedFps,
      frameAvgMs: frameAvgMs > 0 ? Number(frameAvgMs.toFixed(2)) : null,
      frameP95Ms: roundedP95,
      frameHotspotCount: hotspotCountRef.current,
      frameSampleCount: sampleCountRef.current,
      hotspotPercent: roundedHotspotPercent,
      drawCalls: renderInfo.calls,
      triangles: renderInfo.triangles,
      lines: renderInfo.lines,
      points: renderInfo.points,
      alertLevel,
      alerts: perfAlerts,
      lastUpdatedMs: Date.now()
    });

    elapsedRef.current = 0;
  });

  return null;
}
