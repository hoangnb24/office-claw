#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createWorldServer } from "../../apps/server-world/src/worldServer.mjs";

const DEFAULTS = Object.freeze({
  clients: 24,
  settleMs: 4000,
  commandSpacingMs: 10,
  tickRateHz: 20,
  snapshotRateHz: 5,
  sampleMemoryMs: 25,
  commandRateLimitMaxCommands: 1000
});

function parseArgs(argv) {
  const args = {
    ...DEFAULTS,
    out: null,
    eventLogPath: null,
    commandJournalPath: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--clients") {
      args.clients = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (token === "--settle-ms") {
      args.settleMs = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (token === "--command-spacing-ms") {
      args.commandSpacingMs = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (token === "--tick-rate-hz") {
      args.tickRateHz = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (token === "--snapshot-rate-hz") {
      args.snapshotRateHz = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (token === "--sample-memory-ms") {
      args.sampleMemoryMs = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = next;
      i += 1;
      continue;
    }
    if (token === "--event-log-path") {
      args.eventLogPath = next;
      i += 1;
      continue;
    }
    if (token === "--command-journal-path") {
      args.commandJournalPath = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  const integerFields = [
    "clients",
    "settleMs",
    "commandSpacingMs",
    "tickRateHz",
    "snapshotRateHz",
    "sampleMemoryMs"
  ];
  for (const field of integerFields) {
    if (!Number.isInteger(args[field]) || args[field] < 0) {
      throw new Error(`${field} must be a non-negative integer`);
    }
  }
  if (args.clients < 1) {
    throw new Error("clients must be >= 1");
  }
  if (args.settleMs < 1000) {
    throw new Error("settleMs must be >= 1000");
  }
  if (args.sampleMemoryMs < 1) {
    throw new Error("sampleMemoryMs must be >= 1");
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowWallTs() {
  return Date.now();
}

function nowPerfMs() {
  return performance.now();
}

function createEnvelope(type, payload, id) {
  return {
    type,
    id,
    ts: nowWallTs(),
    v: 1,
    payload
  };
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function summarizeLatencies(values) {
  return {
    p50: Number(percentile(values, 0.5).toFixed(2)),
    p95: Number(percentile(values, 0.95).toFixed(2)),
    p99: Number(percentile(values, 0.99).toFixed(2)),
    max: Number((values.length > 0 ? Math.max(...values) : 0).toFixed(2)),
    samples: values.length
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function noopLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

function createClient(url, index) {
  return new Promise((resolve, reject) => {
    const name = `bench-client-${index + 1}`;
    const ws = new WebSocket(url);
    const pendingByCommandId = new Map();
    const responseLatencyMs = [];
    const ackLatencyMs = [];
    const errorLatencyMs = [];
    let commandSeq = 0;
    let ready = false;

    const metrics = {
      name,
      sent: 0,
      ack: 0,
      error: 0,
      events: 0,
      snapshots: 0,
      pongs: 0,
      pendingByCommandId,
      responseLatencyMs,
      ackLatencyMs,
      errorLatencyMs
    };

    function sendCommand(name, data) {
      commandSeq += 1;
      const commandId = `cmd_${index + 1}_${commandSeq}`;
      pendingByCommandId.set(commandId, nowPerfMs());
      ws.send(JSON.stringify(createEnvelope("command", { name, data }, commandId)));
      metrics.sent += 1;
    }

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify(
          createEnvelope(
            "hello",
            {
              client: {
                name,
                build: "world-server-benchmark",
                platform: "node"
              },
              supported_versions: [1]
            },
            `hello_${index + 1}`
          )
        )
      );
    });

    ws.addEventListener("message", (event) => {
      const message = safeJsonParse(String(event.data));
      if (!message || typeof message.type !== "string") {
        return;
      }

      if (message.type === "hello_ack") {
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
        return;
      }

      if (message.type === "snapshot") {
        metrics.snapshots += 1;
        if (!ready) {
          ready = true;
          resolve({ index, ws, metrics, sendCommand });
        }
        return;
      }

      if (message.type === "event") {
        metrics.events += 1;
        return;
      }

      if (message.type === "pong") {
        metrics.pongs += 1;
        return;
      }

      if (message.type === "ack" || message.type === "error") {
        const inReplyTo = message.payload?.in_reply_to;
        if (typeof inReplyTo !== "string") {
          return;
        }
        const startedAt = pendingByCommandId.get(inReplyTo);
        if (!Number.isFinite(startedAt)) {
          return;
        }
        pendingByCommandId.delete(inReplyTo);
        const latencyMs = nowPerfMs() - startedAt;
        responseLatencyMs.push(latencyMs);
        if (message.type === "ack") {
          ackLatencyMs.push(latencyMs);
          metrics.ack += 1;
        } else {
          errorLatencyMs.push(latencyMs);
          metrics.error += 1;
        }
      }
    });

    ws.addEventListener("error", (error) => {
      if (!ready) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    ws.addEventListener("close", () => {
      if (!ready) {
        reject(new Error(`${name} closed before initial snapshot`));
      }
    });
  });
}

async function runBenchmark(args) {
  const server = createWorldServer({
    host: "127.0.0.1",
    port: 0,
    logger: noopLogger(),
    tickRateHz: args.tickRateHz,
    snapshotRateHz: args.snapshotRateHz,
    commandRateLimitMaxCommands: args.commandRateLimitMaxCommands,
    eventLogPath: args.eventLogPath,
    commandJournalPath: args.commandJournalPath
  });

  const startInfo = await server.start();
  const wsUrl = `ws://${startInfo.host}:${startInfo.port}/ws/world`;
  const healthUrl = `http://${startInfo.host}:${startInfo.port}/health`;

  const rssSamples = [];
  const memoryTimer = setInterval(() => {
    rssSamples.push(process.memoryUsage().rss);
  }, args.sampleMemoryMs);

  const clients = await Promise.all(
    Array.from({ length: args.clients }, (_, index) => createClient(wsUrl, index))
  );

  const runStartedMs = nowPerfMs();

  const agentCycle = ["agent_bd", "agent_research_1", "agent_eng_1"];
  const commandPlan = [
    (client) =>
      client.sendCommand("submit_request", { text: `Benchmark request from ${client.metrics.name}` }),
    (client) =>
      client.sendCommand("assign_task", {
        task_id: "task_copy",
        agent_id: agentCycle[client.index % agentCycle.length]
      }),
    () => {},
    () => {},
    (client) => client.sendCommand("start_kickoff", { project_id: "proj_abc" }),
    (client) =>
      client.sendCommand("request_changes", {
        artifact_id: "art_research_report_v1",
        instructions: `Benchmark changes request from ${client.metrics.name}`
      }),
    (client) =>
      client.sendCommand("resolve_decision", {
        decision_id: "dec_audience",
        choice: "Tech users"
      }),
    (client) => client.sendCommand("auto_assign", { project_id: "proj_abc" })
  ];

  for (const step of commandPlan) {
    for (const client of clients) {
      step(client);
      if (args.commandSpacingMs > 0) {
        await sleep(args.commandSpacingMs);
      }
    }
  }

  await sleep(args.settleMs);
  const runFinishedMs = nowPerfMs();

  clearInterval(memoryTimer);

  const health = await fetch(healthUrl).then((response) => response.json());

  let sent = 0;
  let ack = 0;
  let error = 0;
  let events = 0;
  let snapshots = 0;
  let pending = 0;
  const responseLatencyMs = [];
  const ackLatencyMs = [];
  const errorLatencyMs = [];
  for (const client of clients) {
    sent += client.metrics.sent;
    ack += client.metrics.ack;
    error += client.metrics.error;
    events += client.metrics.events;
    snapshots += client.metrics.snapshots;
    pending += client.metrics.pendingByCommandId.size;
    responseLatencyMs.push(...client.metrics.responseLatencyMs);
    ackLatencyMs.push(...client.metrics.ackLatencyMs);
    errorLatencyMs.push(...client.metrics.errorLatencyMs);
  }

  for (const client of clients) {
    client.ws.close(1000, "benchmark_done");
  }
  await server.stop();

  const durationMs = runFinishedMs - runStartedMs;
  const peakRssBytes = rssSamples.length > 0 ? Math.max(...rssSamples) : process.memoryUsage().rss;
  const commandsPerSecond = durationMs > 0 ? sent / (durationMs / 1000) : 0;
  const responsesPerSecond = durationMs > 0 ? (ack + error) / (durationMs / 1000) : 0;

  return {
    generated_at: new Date().toISOString(),
    config: {
      clients: args.clients,
      settle_ms: args.settleMs,
      command_spacing_ms: args.commandSpacingMs,
      tick_rate_hz: args.tickRateHz,
      snapshot_rate_hz: args.snapshotRateHz,
      sample_memory_ms: args.sampleMemoryMs,
      event_log_path: args.eventLogPath,
      command_journal_path: args.commandJournalPath
    },
    totals: {
      sent,
      ack,
      error,
      pending,
      events,
      snapshots,
      duration_ms: Number(durationMs.toFixed(2))
    },
    throughput: {
      commands_sent_per_sec: Number(commandsPerSecond.toFixed(2)),
      terminal_responses_per_sec: Number(responsesPerSecond.toFixed(2))
    },
    latency_ms: {
      response: summarizeLatencies(responseLatencyMs),
      ack: summarizeLatencies(ackLatencyMs),
      error: summarizeLatencies(errorLatencyMs)
    },
    memory: {
      peak_rss_bytes_sampled: peakRssBytes,
      peak_rss_mb_sampled: Number((peakRssBytes / (1024 * 1024)).toFixed(2))
    },
    health_summary: {
      simulation: health?.simulation ?? null,
      observability: health?.observability ?? null,
      command_security: health?.command_security ?? null,
      replay_resync: health?.replay_resync ?? null
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runBenchmark(args);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;

  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, serialized, "utf8");
  }

  process.stdout.write(serialized);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
