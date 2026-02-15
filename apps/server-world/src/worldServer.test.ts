import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createWorldServer } from "./worldServer.js";

const servers: Array<ReturnType<typeof createWorldServer>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await server.stop();
    }
  }
});

async function setupServer() {
  const server = createWorldServer("127.0.0.1", 0);
  servers.push(server);
  await server.start();
  const addr = server.address();
  return { server, wsUrl: `ws://${addr.host}:${addr.port}/ws/world` };
}

async function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

async function nextMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
    ws.once("error", reject);
  });
}

async function sendHello(ws: WebSocket, id = "hello_test"): Promise<void> {
  ws.send(
    JSON.stringify({
      type: "hello",
      id,
      ts: 1,
      v: 1,
      payload: {
        client: {
          name: "test-client",
          build: "test",
          platform: "node"
        }
      }
    })
  );
  await nextMessage(ws);
}

test("hello returns hello_ack", async () => {
  const { server, wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);

  ws.send(JSON.stringify({
    type: "hello",
    id: "hello_1",
    ts: 1,
    v: 1,
    payload: { client: { name: "test-client", build: "test", platform: "node" } }
  }));

  const message = await nextMessage(ws);
  assert.equal(message.type, "hello_ack");
  assert.equal(typeof message.payload.session_id, "string");

  ws.close();
  assert.ok(server.logs.some((log) => log.event === "hello_ack"));
});

test("subscribe after hello emits initial snapshot", async () => {
  const { wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);

  await sendHello(ws, "hello_2");

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_1",
      ts: 2,
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: true,
          snapshots: true,
          goals: true,
          chat: true
        }
      }
    })
  );

  const snapshot = await nextMessage(ws);
  assert.equal(snapshot.type, "snapshot");
  assert.equal(snapshot.payload.scene_id, "cozy_office_v0");

  ws.close();
});

test("subscribe before hello returns protocol-compliant error", async () => {
  const { wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_bad_1",
      ts: 1,
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: true,
          snapshots: true,
          goals: true,
          chat: true
        }
      }
    })
  );

  const error = await nextMessage(ws);
  assert.equal(error.type, "error");
  assert.equal(error.payload.in_reply_to, "sub_bad_1");
  assert.equal(error.payload.code, "NOT_ALLOWED");

  ws.close();
});

test("ping returns pong and logs include connect/disconnect reasons", async () => {
  const { server, wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);

  await sendHello(ws, "hello_3");

  ws.send(
    JSON.stringify({
      type: "ping",
      id: "ping_1",
      ts: 2,
      v: 1,
      payload: {
        nonce: "n1"
      }
    })
  );

  const pong = await nextMessage(ws);
  assert.equal(pong.type, "pong");
  assert.equal(pong.payload.nonce, "n1");

  ws.close(1000, "test_done");
  await new Promise((resolve) => setTimeout(resolve, 20));

  const hasConnect = server.logs.some((log) => log.event === "connect" && log.reason === "ws_open");
  const hasDisconnect = server.logs.some(
    (log) => log.event === "disconnect" && log.reason.includes("test_done")
  );
  assert.equal(hasConnect, true);
  assert.equal(hasDisconnect, true);
});

test("command router returns ack for valid command and exactly one terminal response", async () => {
  const { wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);
  await sendHello(ws, "hello_cmd_1");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_1",
      ts: 2,
      v: 1,
      payload: {
        name: "submit_request",
        data: {
          text: "Create a launch plan"
        }
      }
    })
  );

  const response = await nextMessage(ws);
  assert.equal(response.type, "ack");
  assert.equal(response.payload.in_reply_to, "cmd_1");
  assert.equal(response.payload.status, "ok");

  ws.close();
});

test("command router maps NOT_FOUND and CONFLICT deterministically", async () => {
  const { wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);
  await sendHello(ws, "hello_cmd_2");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_nf",
      ts: 2,
      v: 1,
      payload: {
        name: "assign_task",
        data: {
          task_id: "task_missing",
          agent_id: "agent_eng_1"
        }
      }
    })
  );
  const notFound = await nextMessage(ws);
  assert.equal(notFound.type, "error");
  assert.equal(notFound.payload.in_reply_to, "cmd_nf");
  assert.equal(notFound.payload.code, "NOT_FOUND");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_conflict_1",
      ts: 3,
      v: 1,
      payload: {
        name: "resolve_decision",
        data: {
          decision_id: "dec_audience",
          choice: "Tech users"
        }
      }
    })
  );
  const resolvedAck = await nextMessage(ws);
  assert.equal(resolvedAck.type, "ack");
  assert.equal(resolvedAck.payload.in_reply_to, "cmd_conflict_1");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_conflict_2",
      ts: 4,
      v: 1,
      payload: {
        name: "resolve_decision",
        data: {
          decision_id: "dec_audience",
          choice: "Tech users"
        }
      }
    })
  );
  const conflict = await nextMessage(ws);
  assert.equal(conflict.type, "error");
  assert.equal(conflict.payload.in_reply_to, "cmd_conflict_2");
  assert.equal(conflict.payload.code, "CONFLICT");

  ws.close();
});

test("command router returns VALIDATION_FAILED for malformed/unknown commands", async () => {
  const { wsUrl } = await setupServer();
  const ws = await openSocket(wsUrl);
  await sendHello(ws, "hello_cmd_3");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_bad_1",
      ts: 2,
      v: 1,
      payload: {
        name: "unknown_command",
        data: {}
      }
    })
  );
  const unknown = await nextMessage(ws);
  assert.equal(unknown.type, "error");
  assert.equal(unknown.payload.code, "VALIDATION_FAILED");
  assert.equal(unknown.payload.in_reply_to, "cmd_bad_1");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_bad_2",
      ts: 3,
      v: 1,
      payload: {
        name: "submit_request",
        data: {}
      }
    })
  );
  const malformed = await nextMessage(ws);
  assert.equal(malformed.type, "error");
  assert.equal(malformed.payload.code, "VALIDATION_FAILED");
  assert.equal(malformed.payload.in_reply_to, "cmd_bad_2");

  ws.close();
});
