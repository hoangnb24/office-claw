import type { WorldSocketClient } from "./worldSocketClient";

let activeWorldSocketClient: WorldSocketClient | null = null;

export function setWorldSocketClient(client: WorldSocketClient | null) {
  activeWorldSocketClient = client;
}

export function getWorldSocketClient(): WorldSocketClient | null {
  return activeWorldSocketClient;
}
