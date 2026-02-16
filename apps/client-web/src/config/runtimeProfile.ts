export function isOfflineMockWorldEnabled(env: Record<string, string | undefined> = import.meta.env) {
  return env.VITE_OFFLINE_MOCK_WORLD === "1";
}

export function shouldAutoConnectWorldSocket(
  env: Record<string, string | undefined> = import.meta.env
) {
  return env.VITE_WORLD_WS_AUTO_CONNECT !== "0";
}

export function worldSocketUrl(env: Record<string, string | undefined> = import.meta.env) {
  return env.VITE_WORLD_WS_URL ?? "ws://127.0.0.1:8787/ws/world";
}

export function runtimeSceneId(env: Record<string, string | undefined> = import.meta.env) {
  const configured = env.VITE_SCENE_ID;
  if (typeof configured !== "string") {
    return "cozy_office_v0";
  }
  const normalized = configured.trim();
  return normalized.length > 0 ? normalized : "cozy_office_v0";
}

export function isDebugDiagnosticsProfileEnabled(
  env: Record<string, string | undefined> = import.meta.env
) {
  return env.VITE_DEBUG_HUD === "1" || env.VITE_NAV_DEBUG === "1";
}
