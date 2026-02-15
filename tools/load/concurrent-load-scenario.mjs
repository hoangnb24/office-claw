#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createWorldServer } from "../../apps/server-world/src/worldServer.mjs";

const DEFAULT_CLIENTS = 5;
const DEFAULT_SETTLE_MS = 3000;
const DEFAULT_COMMAND_SPACING_MS = 160;

function parseArgs(argv) {
  const args = {
    clients: DEFAULT_CLIENTS,
    settleMs: DEFAULT_SETTLE_MS,
    out: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--clients") {
      args.clients = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (token === "--settle-ms") {
      args.settleMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
  }

  if (!Number.isInteger(args.clients) || args.clients < 1) {
    throw new Error("--clients must be an integer >= 1");
  }
  if (!Number.isInteger(args.settleMs) || args.settleMs < 1000) {
    throw new Error("--settle-ms must be an integer >= 1000");
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowTs() {
  return Date.now();
}

function createEnvelope(type, payload, id) {
  return {
    type,
    id,
    ts: nowTs(),
    v: 1,
    payload
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function createClientMetrics(name) {
  return {
    name,
    commands_sent: 0,
    ack: 0,
    error: 0,
    events: 0,
    snapshots: 0,
    pings_sent: 0,
    pongs: 0,
    errors_by_code: {}
  };
}

function openClient(url, index) {
  return new Promise((resolve, reject) => {
    const name = `load-client-${index + 1}`;
    const ws = new WebSocket(url);
    const metrics = createClientMetrics(name);
    let ready = false;
    let opened = false;

    ws.addEventListener("open", () => {
      opened = true;
      ws.send(
        JSON.stringify(
          createEnvelope("hello", {
            client: {
              name,
              build: "load",
              platform: "node"
            },
            supported_versions: [1]
          }, `hello_${index + 1}`)
        )
      );
    });

    ws.addEventListener("message", (event) => {
      const envelope = safeJsonParse(String(event.data));
      if (!envelope || typeof envelope.type !== "string") {
        return;
      }

      switch (envelope.type) {
        case "hello_ack":
          ws.send(
            JSON.stringify(
              createEnvelope(
                "subscribe",
                {
                  scene_id: "cozy_office_v0",
                  channels: {
                    events: true,
                    snapshots: true,
                    goals: true,
                    chat: false
                  }
                },
                `sub_${index + 1}`
              )
            )
          );
          break;
        case "snapshot":
          metrics.snapshots += 1;
          if (!ready) {
            ready = true;
            resolve({
              index,
              ws,
              metrics
            });
          }
          break;
        case "event":
          metrics.events += 1;
          break;
        case "ack":
          metrics.ack += 1;
          break;
        case "error": {
          metrics.error += 1;
          const code = envelope.payload?.code ?? "UNKNOWN";
          metrics.errors_by_code[code] = (metrics.errors_by_code[code] || 0) + 1;
          break;
        }
        case "pong":
          metrics.pongs += 1;
          break;
        default:
          break;
      }
    });

    ws.addEventListener("error", (error) => {
      if (!ready) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    ws.addEventListener("close", () => {
      if (!ready && opened) {
        reject(new Error(`client ${name} closed before initial snapshot`));
      }
    });
  });
}

function sendCommand(client, commandName, data) {
  const id = `${commandName}_${client.index}_${client.metrics.commands_sent + 1}`;
  client.ws.send(JSON.stringify(createEnvelope("command", { name: commandName, data }, id)));
  client.metrics.commands_sent += 1;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const server = createWorldServer({
    host: "127.0.0.1",
    port: 0,
    tickRateHz: 20,
    snapshotRateHz: 5
  });
  const started = await server.start();
  const baseUrl = `ws://${started.host}:${started.port}/ws/world`;
  const healthUrl = `http://${started.host}:${started.port}/health`;

  const clients = await Promise.all(
    Array.from({ length: args.clients }, (_, index) => openClient(baseUrl, index))
  );

  const agentCycle = ["agent_bd", "agent_research_1", "agent_eng_1"];
  const commandPlan = [
    (client) => sendCommand(client, "submit_request", { text: `Concurrent request from ${client.metrics.name}` }),
    (client) =>
      sendCommand(client, "assign_task", {
        task_id: "task_copy",
        agent_id: agentCycle[client.index % agentCycle.length]
      }),
    () => {},
    () => {},
    (client) => sendCommand(client, "start_kickoff", { project_id: "proj_abc" }),
    (client) =>
      sendCommand(client, "request_changes", {
        artifact_id: "art_research_report_v1",
        instructions: `Load scenario revision request from ${client.metrics.name}`
      }),
    (client) =>
      sendCommand(client, "resolve_decision", {
        decision_id: "dec_audience",
        choice: "Tech users"
      }),
    (client) => sendCommand(client, "auto_assign", { project_id: "proj_abc" })
  ];

  for (const executeStep of commandPlan) {
    for (const client of clients) {
      executeStep(client);
      client.ws.send(JSON.stringify(createEnvelope("ping", { nonce: `ping_${client.index}_${Date.now()}` })));
      client.metrics.pings_sent += 1;
      await sleep(DEFAULT_COMMAND_SPACING_MS);
    }
  }

  await sleep(args.settleMs);

  const health = await fetch(healthUrl).then((response) => response.json());
  const aggregate = clients.reduce(
    (acc, client) => {
      acc.commands_sent += client.metrics.commands_sent;
      acc.ack += client.metrics.ack;
      acc.error += client.metrics.error;
      acc.events += client.metrics.events;
      acc.snapshots += client.metrics.snapshots;
      acc.pings_sent += client.metrics.pings_sent;
      acc.pongs += client.metrics.pongs;
      return acc;
    },
    {
      commands_sent: 0,
      ack: 0,
      error: 0,
      events: 0,
      snapshots: 0,
      pings_sent: 0,
      pongs: 0
    }
  );

  const summary = {
    generated_at: new Date().toISOString(),
    clients: args.clients,
    settle_ms: args.settleMs,
    aggregate,
    per_client: clients.map((client) => client.metrics),
    health_summary: {
      command_security: health.command_security,
      observability: health.observability,
      error_dashboard: health.error_dashboard,
      simulation: health.simulation
    }
  };

  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  for (const client of clients) {
    client.ws.close();
  }
  await server.stop();

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
