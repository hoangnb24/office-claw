import { Canvas } from "@react-three/fiber";
import { OfficeScene } from "./scene/OfficeScene";
import { LocalNavigationLayer } from "./scene/nav";
import { RuntimeTelemetryProbe } from "./scene/debug";
import { OverlayRoot } from "./overlay/OverlayRoot";
import { useWorldSocket } from "./network/useWorldSocket";
import { isOfflineMockWorldEnabled } from "./config/runtimeProfile";

export function WorkspaceRoute() {
  const offlineMode = isOfflineMockWorldEnabled();
  useWorldSocket("cozy_office_v0");

  return (
    <div className="app-shell" data-runtime-profile={offlineMode ? "offline-mock" : "live-world"}>
      <div className="scene-shell">
        <Canvas
          orthographic
          dpr={[1, 1.5]}
          shadows
          gl={{
            antialias: false,
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
          <RuntimeTelemetryProbe />
        </Canvas>
      </div>
      <OverlayRoot />
    </div>
  );
}
