export function isOfflineMockWorldEnabled(env: Record<string, string | undefined> = import.meta.env) {
  return env.VITE_OFFLINE_MOCK_WORLD === "1";
}

export type RenderQualityTier = "desktop_high" | "balanced" | "mobile";

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  dprMin: number;
  dprMax: number;
  antialias: boolean;
  shadows: boolean;
  keyShadowMapSize: number;
  fogNearScale: number;
  fogFarScale: number;
  ambienceMotionScale: number;
  eventCueDurationMs: number;
}

const QUALITY_PROFILES: Record<RenderQualityTier, RenderQualityProfile> = {
  desktop_high: {
    tier: "desktop_high",
    dprMin: 0.9,
    dprMax: 1.6,
    antialias: true,
    shadows: true,
    keyShadowMapSize: 768,
    fogNearScale: 1,
    fogFarScale: 1,
    ambienceMotionScale: 1,
    eventCueDurationMs: 3400
  },
  balanced: {
    tier: "balanced",
    dprMin: 0.8,
    dprMax: 1.2,
    antialias: false,
    shadows: true,
    keyShadowMapSize: 512,
    fogNearScale: 1,
    fogFarScale: 1.05,
    ambienceMotionScale: 0.8,
    eventCueDurationMs: 3000
  },
  mobile: {
    tier: "mobile",
    dprMin: 0.75,
    dprMax: 1,
    antialias: false,
    shadows: false,
    keyShadowMapSize: 256,
    fogNearScale: 1.15,
    fogFarScale: 1.25,
    ambienceMotionScale: 0.6,
    eventCueDurationMs: 2600
  }
};

export function runtimeRenderQualityTier(
  env: Record<string, string | undefined> = import.meta.env
): RenderQualityTier {
  const raw = env.VITE_RENDER_QUALITY_TIER?.trim().toLowerCase();
  if (raw === "desktop_high" || raw === "high" || raw === "desktop") {
    return "desktop_high";
  }
  if (raw === "balanced" || raw === "medium") {
    return "balanced";
  }
  if (raw === "mobile" || raw === "low") {
    return "mobile";
  }

  const explicitMobile = env.VITE_FORCE_MOBILE_PROFILE === "1";
  if (explicitMobile) {
    return "mobile";
  }
  return "balanced";
}

export function runtimeRenderQualityProfile(
  env: Record<string, string | undefined> = import.meta.env
): RenderQualityProfile {
  return QUALITY_PROFILES[runtimeRenderQualityTier(env)];
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
