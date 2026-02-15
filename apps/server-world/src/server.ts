import { createWorldServer } from "./worldServer.js";

async function main() {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 8787);
  const worldServer = createWorldServer(host, port);

  await worldServer.start();
  const address = worldServer.address();
  console.log(`[server-world] listening on ws://${address.host}:${address.port}/ws/world`);

  const shutdown = async () => {
    await worldServer.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main();
