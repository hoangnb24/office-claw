import { Canvas } from "@react-three/fiber";
import { OfficeScene } from "./scene/OfficeScene";
import { LocalNavigationLayer } from "./scene/nav";
import { RuntimeTelemetryProbe } from "./scene/debug";
import { SceneRuntimeProvider } from "./scene/runtime";
import { OverlayRoot } from "./overlay/OverlayRoot";
import { useWorldSocket } from "./network/useWorldSocket";
import {
  isDebugDiagnosticsProfileEnabled,
  isOfflineMockWorldEnabled,
  runtimeRenderQualityProfile,
  runtimeSceneId
} from "./config/runtimeProfile";
import { useScriptedDemoFlowHotkey } from "./demo/useScriptedDemoFlowHotkey";

export function WorkspaceRoute() {
  const offlineMode = isOfflineMockWorldEnabled();
  const debugDiagnosticsProfile = isDebugDiagnosticsProfileEnabled();
  const renderQuality = runtimeRenderQualityProfile();
  const sceneId = runtimeSceneId();
  const manifestUrl = `/scenes/${sceneId}.scene.json`;

  useWorldSocket(sceneId);
  useScriptedDemoFlowHotkey();

  return (
    <SceneRuntimeProvider initialSceneId={sceneId} initialManifestUrl={manifestUrl} autoLoad>
      <div className="app-shell" data-runtime-profile={offlineMode ? "offline-mock" : "live-world"}>
        <div className="scene-shell">
          <Canvas
            orthographic
            dpr={[renderQuality.dprMin, renderQuality.dprMax]}
            shadows={renderQuality.shadows}
            gl={{
              antialias: renderQuality.antialias,
              powerPreference: "high-performance"
            }}
            camera={{
              position: [12, 12, 12],
              zoom: 1.1,
              near: 0.1,
              far: 200
            }}
          >
            <OfficeScene />
            <LocalNavigationLayer />
            {debugDiagnosticsProfile ? <RuntimeTelemetryProbe /> : null}
          </Canvas>
        </div>
        <OverlayRoot />
      </div>
    </SceneRuntimeProvider>
  );
}
