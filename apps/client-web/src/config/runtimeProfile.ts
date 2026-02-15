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
