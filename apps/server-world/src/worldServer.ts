import http from "node:http";
import { randomUUID } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
import { CommandRouter } from "./commandRouter.js";

export type EnvelopeType =
  | "hello"
  | "hello_ack"
  | "subscribe"
  | "command"
  | "ack"
  | "snapshot"
  | "ping"
  | "pong"
  | "error";

export interface Envelope {
  type: EnvelopeType;
  id: string;
  ts: number;
  v: number;
  payload: Record<string, unknown>;
}

interface SessionData {
  connectionId: string;
  sessionId: string | null;
  helloCompleted: boolean;
  subscribed: boolean;
  lastSeenMs: number;
}

export interface SessionLifecycleLog {
  event: "connect" | "hello_ack" | "subscribe" | "disconnect";
  connectionId: string;
  sessionId: string | null;
  reason: string;
  ts: number;
}

export interface WorldServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  address: () => { host: string; port: number };
  logs: SessionLifecycleLog[];
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

function makeMessage(type: EnvelopeType, id: string, payload: Record<string, unknown>): Envelope {
  return {
    type,
    id,
    ts: nowTs(),
    v: 1,
    payload
  };
}

function send(ws: WebSocket, message: Envelope): void {
  ws.send(JSON.stringify(message));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateHello(message: Envelope): string | null {
  if (message.type !== "hello") {
    return "Expected hello envelope";
  }
  if (!isObject(message.payload)) {
    return "payload must be an object";
  }
  const client = message.payload.client;
  if (!isObject(client)) {
    return "hello.payload.client is required";
  }
  if (typeof client.name !== "string" || typeof client.build !== "string" || typeof client.platform !== "string") {
    return "hello.payload.client.{name,build,platform} must be strings";
  }
  return null;
}

function validateSubscribe(message: Envelope): string | null {
  if (message.type !== "subscribe") {
    return "Expected subscribe envelope";
  }
  if (!isObject(message.payload)) {
    return "payload must be an object";
  }
  if (typeof message.payload.scene_id !== "string" || message.payload.scene_id.length === 0) {
    return "subscribe.payload.scene_id is required";
  }
  if (!isObject(message.payload.channels)) {
    return "subscribe.payload.channels is required";
  }
  return null;
}

export function createWorldServer(host = "127.0.0.1", port = 0): WorldServer {
  const logs: SessionLifecycleLog[] = [];

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  const wss = new WebSocketServer({ server, path: "/ws/world" });
  const sessions = new Map<WebSocket, SessionData>();
  const commandRouter = new CommandRouter();

  const heartbeatTimer = setInterval(() => {
    const nowMs = Date.now();
    for (const [ws, session] of sessions.entries()) {
      if (nowMs - session.lastSeenMs > 45_000) {
        logs.push({
          event: "disconnect",
          connectionId: session.connectionId,
          sessionId: session.sessionId,
          reason: "heartbeat_timeout",
          ts: nowTs()
        });
        ws.close(4000, "heartbeat_timeout");
        sessions.delete(ws);
      }
    }
  }, 5_000);

  wss.on("connection", (ws) => {
    const connectionId = `conn_${randomUUID().slice(0, 8)}`;
    const session: SessionData = {
      connectionId,
      sessionId: null,
      helloCompleted: false,
      subscribed: false,
      lastSeenMs: Date.now()
    };
    sessions.set(ws, session);

    logs.push({
      event: "connect",
      connectionId,
      sessionId: null,
      reason: "ws_open",
      ts: nowTs()
    });

    ws.on("message", (raw) => {
      session.lastSeenMs = Date.now();

      let message: Envelope;
      try {
        message = JSON.parse(raw.toString()) as Envelope;
      } catch {
        send(
          ws,
          makeMessage("error", `err_${randomUUID().slice(0, 8)}`, {
            in_reply_to: "unknown",
            code: "VALIDATION_FAILED",
            message: "Invalid JSON envelope"
          })
        );
        return;
      }

      if (!session.helloCompleted && message.type !== "hello") {
        send(
          ws,
          makeMessage("error", `err_${randomUUID().slice(0, 8)}`, {
            in_reply_to: message.id,
            code: "NOT_ALLOWED",
            message: "hello must be sent before other messages"
          })
        );
        return;
      }

      if (message.type === "hello") {
        const validationError = validateHello(message);
        if (validationError) {
          send(
            ws,
            makeMessage("error", `err_${randomUUID().slice(0, 8)}`, {
              in_reply_to: message.id,
              code: "VALIDATION_FAILED",
              message: validationError
            })
          );
          return;
        }

        session.sessionId = `sess_${randomUUID().slice(0, 8)}`;
        session.helloCompleted = true;

        send(
          ws,
          makeMessage("hello_ack", `helloack_${randomUUID().slice(0, 8)}`, {
            session_id: session.sessionId,
            protocol_v: 1,
            protocol_version: 1
          })
        );

        logs.push({
          event: "hello_ack",
          connectionId: session.connectionId,
          sessionId: session.sessionId,
          reason: "hello_valid",
          ts: nowTs()
        });
        return;
      }

      if (message.type === "subscribe") {
        const validationError = validateSubscribe(message);
        if (validationError) {
          send(
            ws,
            makeMessage("error", `err_${randomUUID().slice(0, 8)}`, {
              in_reply_to: message.id,
              code: "VALIDATION_FAILED",
              message: validationError
            })
          );
          return;
        }

        session.subscribed = true;
        logs.push({
          event: "subscribe",
          connectionId: session.connectionId,
          sessionId: session.sessionId,
          reason: "subscribe_valid",
          ts: nowTs()
        });

        send(
          ws,
          makeMessage("snapshot", `snap_${randomUUID().slice(0, 8)}`, {
            scene_id: message.payload.scene_id,
            agents: [],
            projects: [],
            tasks: [],
            artifacts: [],
            decisions: []
          })
        );
        return;
      }

      if (message.type === "ping") {
        send(
          ws,
          makeMessage("pong", `pong_${randomUUID().slice(0, 8)}`, {
            nonce: message.payload.nonce ?? null
          })
        );
        return;
      }

      if (message.type === "command") {
        const result = commandRouter.handle(message.payload);
        if (result.ok) {
          send(
            ws,
            makeMessage("ack", `ack_${randomUUID().slice(0, 8)}`, {
              in_reply_to: message.id,
              status: "ok"
            })
          );
        } else {
          send(
            ws,
            makeMessage("error", `err_${randomUUID().slice(0, 8)}`, {
              in_reply_to: message.id,
              code: result.code ?? "INTERNAL",
              message: result.message ?? "command failed"
            })
          );
        }
        return;
      }

      send(
        ws,
        makeMessage("error", `err_${randomUUID().slice(0, 8)}`, {
          in_reply_to: message.id,
          code: "NOT_ALLOWED",
          message: `Unsupported message type: ${message.type}`
        })
      );
    });

    ws.on("close", (code, reason) => {
      logs.push({
        event: "disconnect",
        connectionId: session.connectionId,
        sessionId: session.sessionId,
        reason: reason.toString() || `close_code_${code}`,
        ts: nowTs()
      });
      sessions.delete(ws);
    });
  });

  return {
    start: () =>
      new Promise((resolve) => {
        server.listen(port, host, () => resolve());
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        clearInterval(heartbeatTimer);
        wss.close((wssErr) => {
          server.close((serverErr) => {
            if (wssErr || serverErr) {
              reject(wssErr || serverErr);
              return;
            }
            resolve();
          });
        });
      }),
    address: () => {
      const serverAddress = server.address();
      if (!serverAddress || typeof serverAddress === "string") {
        return { host, port };
      }
      return { host, port: serverAddress.port };
    },
    logs
  };
}
