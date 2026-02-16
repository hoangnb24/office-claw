import type { CommandDataMap, CommandGateway, CommandName, CommandSubmission } from "./commandGateway";
import type { WorldSocketClient } from "./worldSocketClient";

export function createWorldSocketGateway(client: WorldSocketClient): CommandGateway {
  return {
    sendCommand<K extends CommandName>(
      name: K,
      data: CommandDataMap[K]
    ): CommandSubmission<K> | null {
      const commandId = client.sendCommand(name, data);
      if (!commandId) {
        return null;
      }
      return {
        commandId,
        commandName: name,
        sentAt: Date.now()
      };
    }
  };
}
