import { AssetManager, type AssetTelemetryEvent } from "./AssetManager";

function logAssetTelemetry(event: AssetTelemetryEvent) {
  if (event.name === "load_error") {
    console.error("[asset] load_error", event.url, event.error);
    return;
  }

  if (event.name === "load_success") {
    console.info("[asset] load_success", event.url, `${Math.round(event.durationMs ?? 0)}ms`);
    return;
  }

  if (event.name === "cache_hit") {
    console.debug("[asset] cache_hit", event.url);
    return;
  }

  console.debug("[asset]", event.name, event.url);
}

export const assetManager = new AssetManager({
  onTelemetryEvent: logAssetTelemetry
});
