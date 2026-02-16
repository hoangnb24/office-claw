import type { CommandGateway } from "./commandGateway";
import type { WorldSocketClient } from "./worldSocketClient";

let activeWorldSocketClient: WorldSocketClient | null = null;
let activeCommandGateway: CommandGateway | null = null;

export function setWorldSocketClient(client: WorldSocketClient | null) {
  activeWorldSocketClient = client;
}

export function getWorldSocketClient(): WorldSocketClient | null {
  return activeWorldSocketClient;
}

export function setCommandGateway(gateway: CommandGateway | null) {
  activeCommandGateway = gateway;
}

export function getCommandGateway(): CommandGateway | null {
  return activeCommandGateway;
}
