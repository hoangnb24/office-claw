import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { createWorldServer, validateSnapshotCoherence } from "../src/index.mjs";

function waitForMessage(ws) {
  return new Promise((resolve) => {
    ws.once("message", (raw) => resolve(JSON.parse(raw.toString())));
  });
}

function waitForNoMessage(ws, timeoutMs = 50) {
  return new Promise((resolve, reject) => {
    let done = false;
    const onMessage = () => {
      if (!done) {
        done = true;
        reject(new Error("unexpected extra message"));
      }
    };
    ws.once("message", onMessage);
    setTimeout(() => {
      if (!done) {
        done = true;
        ws.off("message", onMessage);
        resolve();
      }
    }, timeoutMs);
  });
}

function createMessageQueue(ws) {
  const queue = [];
  const waiters = [];

  const onMessage = (raw) => {
    const parsed = JSON.parse(raw.toString());
    if (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter(parsed);
      return;
    }
    queue.push(parsed);
  };

  ws.on("message", onMessage);

  return {
    async next(timeoutMs = 800) {
      if (queue.length > 0) {
        return queue.shift();
      }
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = waiters.indexOf(onResolve);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(new Error(`timed out waiting for message after ${timeoutMs}ms`));
        }, timeoutMs);

        const onResolve = (message) => {
          clearTimeout(timeout);
          resolve(message);
        };

        waiters.push(onResolve);
      });
    },

    stop() {
      ws.off("message", onMessage);
    }
  };
}

async function testHelloSubscribeLifecycle() {
  const logs = [];
  const server = createWorldServer({
    logger: {
      info: (_prefix, entry) => logs.push(entry)
    }
  });
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);

  await new Promise((resolve) => ws.once("open", resolve));

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_001",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  const helloAck = await waitForMessage(ws);
  assert.equal(helloAck.type, "hello_ack");
  assert.equal(typeof helloAck.payload.session_id, "string");
  assert.equal(helloAck.payload.resume.status, "snapshot_required");

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_001",
      ts: Date.now(),
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

  const snapshot = await waitForMessage(ws);
  assert.equal(snapshot.type, "snapshot");
  assert.equal(snapshot.payload.scene_id, "cozy_office_v0");
  assert.ok(Array.isArray(snapshot.payload.tasks));
  assert.equal(typeof snapshot.payload.seq, "number");
  assert.equal(typeof snapshot.payload.snapshot_seq, "number");
  assert.equal(typeof snapshot.payload.clock_ms, "number");
  assert.equal(snapshot.payload.correction.mode, "ease");
  assert.equal(snapshot.payload.publisher.rate_hz >= 2, true);
  assert.equal(validateSnapshotCoherence(snapshot.payload).ok, true);

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();

  assert.ok(logs.some((entry) => entry.kind === "connected"));
  assert.ok(logs.some((entry) => entry.kind === "disconnected"));
}

async function testSimulationStatsExposed() {
  const server = createWorldServer({ tickRateHz: 20 });
  await server.start();

  const statsBefore = server.getSimulationStats();
  assert.equal(statsBefore.tick_rate_hz, 20);
  assert.ok(statsBefore.tick_interval_ms > 0);

  server.tickSimulation(3);
  const statsAfter = server.getSimulationStats();
  assert.ok(statsAfter.tick_count >= statsBefore.tick_count + 3);
  assert.ok(statsAfter.seq >= statsBefore.seq + 3);
  assert.ok(statsAfter.clock_ms > statsBefore.clock_ms);
  assert.equal(typeof statsAfter.tick_timing_ms.last_tick_duration_ms, "number");
  assert.equal(statsAfter.tick_timing_ms.samples >= 1, true);
  assert.equal(typeof statsAfter.queue_latency_ms.commands.avg, "number");
  assert.equal(typeof statsAfter.queue_latency_ms.events.avg, "number");

  const snapshotPublisher = server.getSnapshotPublisherStats();
  assert.ok(snapshotPublisher.rate_hz >= 2);
  assert.ok(snapshotPublisher.interval_ms > 0);

  await server.stop();
}

async function testLowRateSnapshotPublisher() {
  const server = createWorldServer({ tickRateHz: 20, snapshotRateHz: 5 });
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => ws.once("open", resolve));
  const queue = createMessageQueue(ws);

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_snap_pub",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  assert.equal((await queue.next()).type, "hello_ack");

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_snap_pub",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: false,
          snapshots: true,
          goals: false,
          chat: false
        }
      }
    })
  );
  const initial = await queue.next();
  assert.equal(initial.type, "snapshot");

  const streamed = await queue.next(1200);
  assert.equal(streamed.type, "snapshot");
  assert.ok(streamed.payload.snapshot_seq >= initial.payload.snapshot_seq);
  assert.equal(streamed.payload.correction.mode, "ease");
  assert.equal(streamed.payload.publisher.rate_hz, 5);

  queue.stop();
  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testAgentStreamPassthroughChannelGating() {
  const server = createWorldServer();
  const { port } = await server.start();
  const wsStreamOn = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  const wsStreamOff = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await Promise.all([
    new Promise((resolve) => wsStreamOn.once("open", resolve)),
    new Promise((resolve) => wsStreamOff.once("open", resolve))
  ]);

  const queueOn = createMessageQueue(wsStreamOn);
  const queueOff = createMessageQueue(wsStreamOff);

  for (const [index, ws] of [
    [0, wsStreamOn],
    [1, wsStreamOff]
  ]) {
    ws.send(
      JSON.stringify({
        type: "hello",
        id: `hello_stream_${index}`,
        ts: Date.now(),
        v: 1,
        payload: {
          client: {
            name: "officeclaw-web",
            build: "test",
            platform: "web"
          }
        }
      })
    );
  }
  assert.equal((await queueOn.next()).type, "hello_ack");
  assert.equal((await queueOff.next()).type, "hello_ack");

  wsStreamOn.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_stream_on",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: false,
          snapshots: false,
          goals: false,
          chat: false,
          agent_stream: true
        }
      }
    })
  );
  wsStreamOff.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_stream_off",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: false,
          snapshots: false,
          goals: false,
          chat: false,
          agent_stream: false
        }
      }
    })
  );

  assert.equal((await queueOn.next()).type, "snapshot");
  assert.equal((await queueOff.next()).type, "snapshot");

  const first = server.publishAgentStream({
    stream_id: "oc_run_stream_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "token",
    seq: 1,
    delta: "partial update",
    done: false
  });
  assert.equal(first.ok, true);
  const streamEnvelope = await queueOn.next();
  assert.equal(streamEnvelope.type, "agent_stream");
  assert.equal(streamEnvelope.payload.stream_id, "oc_run_stream_1");
  assert.equal(streamEnvelope.payload.seq, 1);
  assert.equal(streamEnvelope.payload.done, false);

  let sawUnexpectedOffMessage = false;
  try {
    await queueOff.next(150);
    sawUnexpectedOffMessage = true;
  } catch {
    // Expected timeout; stream channel is disabled for this client.
  }
  assert.equal(sawUnexpectedOffMessage, false);

  const done = server.publishAgentStream({
    stream_id: "oc_run_stream_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "token",
    seq: 2,
    delta: "",
    done: true
  });
  assert.equal(done.ok, true);
  const doneEnvelope = await queueOn.next();
  assert.equal(doneEnvelope.type, "agent_stream");
  assert.equal(doneEnvelope.payload.done, true);
  assert.equal(doneEnvelope.payload.seq, 2);

  const conflict = server.publishAgentStream({
    stream_id: "oc_run_stream_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "token",
    seq: 3,
    delta: "post_done",
    done: false
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "CONFLICT");

  const whitespaceVariantConflict = server.publishAgentStream({
    stream_id: "oc_run_stream_1 ",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "token",
    seq: 3,
    delta: "post_done_whitespace_variant",
    done: false
  });
  assert.equal(whitespaceVariantConflict.ok, false);
  assert.equal(whitespaceVariantConflict.code, "CONFLICT");

  const invalidKind = server.publishAgentStream({
    stream_id: "oc_run_stream_2",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "telemetry",
    seq: 1,
    delta: "invalid kind payload",
    done: false
  });
  assert.equal(invalidKind.ok, false);
  assert.equal(invalidKind.code, "VALIDATION_FAILED");

  queueOn.stop();
  queueOff.stop();
  wsStreamOn.close(1000, "test_done");
  wsStreamOff.close(1000, "test_done");
  await Promise.all([
    new Promise((resolve) => wsStreamOn.once("close", resolve)),
    new Promise((resolve) => wsStreamOff.once("close", resolve))
  ]);
  await server.stop();
}

async function testTaskProgressPreviewSafetyAndRateLimit() {
  const server = createWorldServer();
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => ws.once("open", resolve));

  const queue = createMessageQueue(ws);

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_progress_preview",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  assert.equal((await queue.next()).type, "hello_ack");

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_progress_preview",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: true,
          snapshots: false,
          goals: false,
          chat: false,
          agent_stream: true
        }
      }
    })
  );
  assert.equal((await queue.next()).type, "snapshot");

  const first = server.publishAgentStream({
    stream_id: "oc_run_progress_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "thought",
    seq: 1,
    delta: "I think we should inspect logs and branch on failures.",
    done: false
  });
  assert.equal(first.ok, true);
  assert.equal((await queue.next()).type, "agent_stream");
  const firstProgress = await queue.next();
  assert.equal(firstProgress.type, "event");
  assert.equal(firstProgress.payload.name, "task_progress");
  assert.equal(firstProgress.payload.task_id, "task_copy");
  assert.equal(firstProgress.payload.kind, "thought");
  assert.equal(firstProgress.payload.percent >= 1 && firstProgress.payload.percent <= 99, true);
  assert.equal(firstProgress.payload.preview_text.includes("inspect logs"), false);
  assert.equal(firstProgress.payload.preview_text.includes("I think"), false);

  const firstCount = server
    .getEventTimeline({ sinceSeq: 0 })
    .filter((event) => event.name === "task_progress").length;
  assert.equal(firstCount, 1);

  const second = server.publishAgentStream({
    stream_id: "oc_run_progress_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "thought",
    seq: 2,
    delta: "additional detail that should never be exposed",
    done: false
  });
  assert.equal(second.ok, true);
  assert.equal((await queue.next()).type, "agent_stream");
  await waitForNoMessage(ws, 120);

  const secondCount = server
    .getEventTimeline({ sinceSeq: 0 })
    .filter((event) => event.name === "task_progress").length;
  assert.equal(secondCount, 1);

  const crossProject = server.publishAgentStream({
    stream_id: "oc_run_progress_2",
    agent_id: "agent_eng_1",
    project_id: "proj_other",
    task_id: "task_copy",
    kind: "token",
    seq: 1,
    delta: "separate project should not share throttling state",
    done: false
  });
  assert.equal(crossProject.ok, true);
  assert.equal((await queue.next()).type, "agent_stream");
  const crossProjectProgress = await queue.next();
  assert.equal(crossProjectProgress.type, "event");
  assert.equal(crossProjectProgress.payload.name, "task_progress");
  assert.equal(crossProjectProgress.payload.project_id, "proj_other");

  await new Promise((resolve) => setTimeout(resolve, 550));
  const third = server.publishAgentStream({
    stream_id: "oc_run_progress_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "code",
    seq: 3,
    delta: "running compile checks now",
    done: false
  });
  assert.equal(third.ok, true);
  assert.equal((await queue.next()).type, "agent_stream");
  const delayedProgress = await queue.next();
  assert.equal(delayedProgress.type, "event");
  assert.equal(delayedProgress.payload.name, "task_progress");
  assert.equal(delayedProgress.payload.kind, "code");

  const thirdCount = server
    .getEventTimeline({ sinceSeq: 0 })
    .filter((event) => event.name === "task_progress").length;
  assert.equal(thirdCount, 3);

  const done = server.publishAgentStream({
    stream_id: "oc_run_progress_1",
    agent_id: "agent_eng_1",
    project_id: "proj_abc",
    task_id: "task_copy",
    kind: "code",
    seq: 4,
    delta: "",
    done: true
  });
  assert.equal(done.ok, true);
  assert.equal((await queue.next()).type, "agent_stream");
  const doneProgress = await queue.next();
  assert.equal(doneProgress.type, "event");
  assert.equal(doneProgress.payload.name, "task_progress");
  assert.equal(doneProgress.payload.percent, 99);
  assert.equal(doneProgress.payload.preview_text, "Finalizing task output.");

  queue.stop();
  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testInvalidHandshakeError() {
  const server = createWorldServer();
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);

  await new Promise((resolve) => ws.once("open", resolve));

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_invalid",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: { events: true }
      }
    })
  );

  const err = await waitForMessage(ws);
  assert.equal(err.type, "error");
  assert.equal(err.payload.code, "VALIDATION_FAILED");
  assert.equal(err.payload.in_reply_to, "sub_invalid");

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testMalformedHelloError() {
  const server = createWorldServer();
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);

  await new Promise((resolve) => ws.once("open", resolve));

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_invalid",
      ts: Date.now(),
      v: 1,
      payload: {}
    })
  );

  const err = await waitForMessage(ws);
  assert.equal(err.type, "error");
  assert.equal(err.payload.code, "VALIDATION_FAILED");
  assert.equal(err.payload.in_reply_to, "hello_invalid");

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testCommandRouterAckAndError() {
  const server = createWorldServer();
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);

  await new Promise((resolve) => ws.once("open", resolve));
  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_cmd",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await waitForMessage(ws);

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_submit",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "submit_request",
        data: {
          text: "Create launch plan"
        }
      }
    })
  );
  const ack = await waitForMessage(ws);
  assert.equal(ack.type, "ack");
  assert.equal(ack.payload.in_reply_to, "cmd_submit");
  assert.equal(ack.payload.status, "ok");
  await waitForNoMessage(ws);

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_missing_task",
      ts: Date.now(),
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
  const notFound = await waitForMessage(ws);
  assert.equal(notFound.type, "error");
  assert.equal(notFound.payload.in_reply_to, "cmd_missing_task");
  assert.equal(notFound.payload.code, "NOT_FOUND");
  await waitForNoMessage(ws);

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_resolve_1",
      ts: Date.now(),
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
  const resolveAck = await waitForMessage(ws);
  assert.equal(resolveAck.type, "ack");
  assert.equal(resolveAck.payload.in_reply_to, "cmd_resolve_1");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_resolve_2",
      ts: Date.now(),
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
  const conflict = await waitForMessage(ws);
  assert.equal(conflict.type, "error");
  assert.equal(conflict.payload.in_reply_to, "cmd_resolve_2");
  assert.equal(conflict.payload.code, "CONFLICT");
  await waitForNoMessage(ws);

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_unknown",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "unknown_command",
        data: {}
      }
    })
  );
  const validationErr = await waitForMessage(ws);
  assert.equal(validationErr.type, "error");
  assert.equal(validationErr.payload.in_reply_to, "cmd_unknown");
  assert.equal(validationErr.payload.code, "VALIDATION_FAILED");
  await waitForNoMessage(ws);

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testCommandRateLimiting() {
  const server = createWorldServer({
    commandRateLimitMaxCommands: 2,
    commandRateLimitWindowMs: 10_000
  });
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);

  await new Promise((resolve) => ws.once("open", resolve));
  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_rate",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await waitForMessage(ws);

  for (let index = 0; index < 2; index += 1) {
    ws.send(
      JSON.stringify({
        type: "command",
        id: `cmd_rate_ok_${index}`,
        ts: Date.now(),
        v: 1,
        payload: {
          name: "submit_request",
          data: {
            text: `rate test ${index}`
          }
        }
      })
    );
    const ack = await waitForMessage(ws);
    assert.equal(ack.type, "ack");
    assert.equal(ack.payload.status, "ok");
  }

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_rate_limited",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "submit_request",
        data: {
          text: "rate test limited"
        }
      }
    })
  );
  const limited = await waitForMessage(ws);
  assert.equal(limited.type, "error");
  assert.equal(limited.payload.in_reply_to, "cmd_rate_limited");
  assert.equal(limited.payload.code, "RATE_LIMITED");

  const securityStats = server.getCommandSecurityStats();
  assert.equal(securityStats.rate_limited >= 1, true);
  assert.equal(securityStats.rate_limit.max_commands, 2);

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testOverrideControlCommandsAndEvents() {
  const server = createWorldServer();
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => ws.once("open", resolve));
  const queue = createMessageQueue(ws);

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_override",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  assert.equal((await queue.next()).type, "hello_ack");

  ws.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_override",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: true,
          snapshots: false,
          goals: false,
          chat: false
        }
      }
    })
  );
  assert.equal((await queue.next()).type, "snapshot");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_pause_project",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "pause_project",
        data: {
          project_id: "proj_abc",
          scope: "dispatch_only"
        }
      }
    })
  );
  const pauseAck = await queue.next();
  const pauseEvent = await queue.next();
  assert.equal(pauseAck.type, "ack");
  assert.equal(pauseAck.payload.in_reply_to, "cmd_pause_project");
  assert.equal(pauseEvent.type, "event");
  assert.equal(pauseEvent.payload.name, "project_paused");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_assign_paused",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "assign_task",
        data: {
          task_id: "task_copy",
          agent_id: "agent_eng_1"
        }
      }
    })
  );
  const pausedAssignError = await queue.next();
  assert.equal(pausedAssignError.type, "error");
  assert.equal(pausedAssignError.payload.in_reply_to, "cmd_assign_paused");
  assert.equal(pausedAssignError.payload.code, "NOT_ALLOWED");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_cancel_conflict",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "cancel_task",
        data: {
          task_id: "task_copy",
          confirm: true,
          expected_task_status: "blocked"
        }
      }
    })
  );
  const cancelConflict = await queue.next();
  assert.equal(cancelConflict.type, "error");
  assert.equal(cancelConflict.payload.code, "CONFLICT");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_cancel_ok",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "cancel_task",
        data: {
          task_id: "task_copy",
          confirm: true,
          expected_task_status: "planned"
        }
      }
    })
  );
  const cancelAck = await queue.next();
  const cancelEvent = await queue.next();
  assert.equal(cancelAck.type, "ack");
  assert.equal(cancelAck.payload.in_reply_to, "cmd_cancel_ok");
  assert.equal(cancelEvent.type, "event");
  assert.equal(cancelEvent.payload.name, "task_cancelled");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_rerun_ok",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "rerun_task",
        data: {
          source_task_id: "task_copy",
          mode: "clone_as_new",
          reason: "new direction"
        }
      }
    })
  );
  const rerunAck = await queue.next();
  const rerunEvent = await queue.next();
  assert.equal(rerunAck.type, "ack");
  assert.equal(rerunAck.payload.in_reply_to, "cmd_rerun_ok");
  assert.equal(rerunEvent.type, "event");
  assert.equal(rerunEvent.payload.name, "tasks_created");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_resume_project",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "resume_project",
        data: {
          project_id: "proj_abc",
          expected_project_status: "blocked"
        }
      }
    })
  );
  const resumeAck = await queue.next();
  const resumeEvent = await queue.next();
  assert.equal(resumeAck.type, "ack");
  assert.equal(resumeAck.payload.in_reply_to, "cmd_resume_project");
  assert.equal(resumeEvent.type, "event");
  assert.equal(resumeEvent.payload.name, "project_resumed");

  const snapshot = server.getSnapshot();
  const cancelledTask = snapshot.tasks.find((task) => task.task_id === "task_copy");
  assert.equal(cancelledTask?.status, "cancelled");
  const rerunTasks = snapshot.tasks.filter((task) => task.rerun_of_task_id === "task_copy");
  assert.equal(rerunTasks.length >= 1, true);
  assert.equal(rerunTasks[0].status, "planned");

  queue.stop();
  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testObservabilityStatsAndAlerts() {
  const alerts = [];
  const server = createWorldServer({
    commandRateLimitMaxCommands: 1,
    commandRateLimitWindowMs: 10_000,
    observabilityAlertThresholds: {
      validation_failed: 1,
      rate_limited: 1,
      socket_errors: 1,
      restoration_blocked: 1
    },
    observabilityAlertHandler: (alert) => alerts.push(alert)
  });
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => ws.once("open", resolve));

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_obs",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await waitForMessage(ws);

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_obs_invalid",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "unknown_command",
        data: {}
      }
    })
  );
  const invalid = await waitForMessage(ws);
  assert.equal(invalid.type, "error");
  assert.equal(invalid.payload.code, "VALIDATION_FAILED");

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_obs_rate",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "submit_request",
        data: {
          text: "observe rate limit"
        }
      }
    })
  );
  const limited = await waitForMessage(ws);
  assert.equal(limited.type, "error");
  assert.equal(limited.payload.code, "RATE_LIMITED");

  const observability = server.getObservabilityStats();
  assert.equal(observability.command.attempted >= 2, true);
  assert.equal(observability.command.failed >= 1, true);
  assert.equal(observability.command.rate_limited >= 1, true);
  assert.equal(observability.inbound_messages.command >= 2, true);
  assert.equal(observability.outbound_messages.error >= 2, true);

  const dashboard = server.getErrorDashboard();
  assert.equal(dashboard.status, "warning");
  assert.equal(dashboard.alerts.some((alert) => alert.key === "validation_failed"), true);
  assert.equal(dashboard.alerts.some((alert) => alert.key === "rate_limited"), true);
  assert.equal(alerts.some((alert) => alert.key === "validation_failed"), true);
  assert.equal(alerts.some((alert) => alert.key === "rate_limited"), true);

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testPrivacyDiagnosticsExportDefaults() {
  const server = createWorldServer({
    diagnosticsRetentionMaxEntries: 3,
    diagnosticsRetentionMaxAgeMs: 60_000
  });
  const { port } = await server.start();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => ws.once("open", resolve));

  ws.send(
    JSON.stringify({
      type: "hello",
      id: "hello_privacy",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await waitForMessage(ws);

  ws.send(
    JSON.stringify({
      type: "command",
      id: "cmd_privacy_submit",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "submit_request",
        data: {
          text: "sensitive launch notes"
        }
      }
    })
  );
  const ack = await waitForMessage(ws);
  assert.equal(ack.type, "ack");

  const redacted = server.exportDiagnostics();
  assert.equal(redacted.include_sensitive, false);
  assert.equal(redacted.lifecycle_log.length <= 3, true);

  const sensitive = server.exportDiagnostics({ includeSensitive: true });
  assert.equal(sensitive.include_sensitive, true);
  assert.equal(sensitive.lifecycle_log.length <= 3, true);

  const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
  const health = await healthRes.json();
  assert.equal(health.privacy_controls.export_default_redacted, true);
  assert.equal(health.privacy_controls.diagnostics_retention.max_entries, 3);
  assert.equal(typeof health.simulation.tick_timing_ms.last_tick_duration_ms, "number");
  assert.equal(typeof health.simulation.queue_latency_ms.commands.p95, "number");
  assert.equal(typeof health.simulation.queue_latency_ms.events.p95, "number");
  assert.equal(typeof health.simulation.openclaw_runs.total, "number");
  assert.equal(typeof health.simulation.openclaw_runs.active, "number");

  ws.close(1000, "test_done");
  await new Promise((resolve) => ws.once("close", resolve));
  await server.stop();
}

async function testSemanticEventTimelineOrdering() {
  const server = createWorldServer();
  const { port } = await server.start();
  const wsA = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  const wsB = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);

  await Promise.all([
    new Promise((resolve) => wsA.once("open", resolve)),
    new Promise((resolve) => wsB.once("open", resolve))
  ]);

  const queueA = createMessageQueue(wsA);
  const queueB = createMessageQueue(wsB);

  const sendHello = (ws, id) =>
    ws.send(
      JSON.stringify({
        type: "hello",
        id,
        ts: Date.now(),
        v: 1,
        payload: {
          client: {
            name: "officeclaw-web",
            build: "test",
            platform: "web"
          }
        }
      })
    );

  const sendSubscribe = (ws, id) =>
    ws.send(
      JSON.stringify({
        type: "subscribe",
        id,
        ts: Date.now(),
        v: 1,
        payload: {
          scene_id: "cozy_office_v0",
          channels: {
            events: true,
            snapshots: false,
            goals: false,
            chat: false
          }
        }
      })
    );

  sendHello(wsA, "hello_a");
  sendHello(wsB, "hello_b");
  assert.equal((await queueA.next()).type, "hello_ack");
  assert.equal((await queueB.next()).type, "hello_ack");

  sendSubscribe(wsA, "sub_a");
  sendSubscribe(wsB, "sub_b");
  assert.equal((await queueA.next()).type, "snapshot");
  assert.equal((await queueB.next()).type, "snapshot");

  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_assign",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "assign_task",
        data: {
          task_id: "task_copy",
          agent_id: "agent_eng_1"
        }
      }
    })
  );

  const ack1 = await queueA.next();
  const eventA1 = await queueA.next();
  const eventB1 = await queueB.next();
  assert.equal(ack1.type, "ack");
  assert.equal(eventA1.type, "event");
  assert.equal(eventB1.type, "event");
  assert.equal(eventA1.payload.name, "task_assigned");
  assert.equal(eventB1.payload.name, "task_assigned");
  assert.equal(eventA1.payload.seq, eventB1.payload.seq);

  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_resolve",
      ts: Date.now(),
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

  const ack2 = await queueA.next();
  const eventA2 = await queueA.next();
  const eventB2 = await queueB.next();
  assert.equal(ack2.type, "ack");
  assert.equal(eventA2.type, "event");
  assert.equal(eventB2.type, "event");
  assert.equal(eventA2.payload.name, "decision_resolved");
  assert.equal(eventB2.payload.name, "decision_resolved");
  assert.equal(eventA2.payload.seq, eventB2.payload.seq);
  assert.ok(eventA2.payload.seq > eventA1.payload.seq);

  const timeline = server.getEventTimeline({ sinceSeq: 0 });
  assert.ok(timeline.length >= 2);
  assert.ok(timeline[0].seq < timeline[1].seq);
  assert.equal(server.getEventTimelineStats().latest_seq, timeline[timeline.length - 1].seq);

  queueA.stop();
  queueB.stop();
  wsA.close(1000, "test_done");
  wsB.close(1000, "test_done");
  await Promise.all([
    new Promise((resolve) => wsA.once("close", resolve)),
    new Promise((resolve) => wsB.once("close", resolve))
  ]);
  await server.stop();
}

async function testReplayCursorApiAndDurableEventLog() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "officeclaw-world-server-"));
  const eventLogPath = path.join(tempDir, "events.jsonl");

  const serverA = createWorldServer({ eventLogPath });
  const { port: portA } = await serverA.start();
  const wsA = new WebSocket(`ws://127.0.0.1:${portA}/ws/world`);
  await new Promise((resolve) => wsA.once("open", resolve));

  const queueA = createMessageQueue(wsA);
  wsA.send(
    JSON.stringify({
      type: "hello",
      id: "hello_replay_a",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await queueA.next();
  wsA.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_replay_a",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: true,
          snapshots: false,
          goals: false,
          chat: false
        }
      }
    })
  );
  await queueA.next(); // initial snapshot

  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_replay_assign",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "assign_task",
        data: {
          task_id: "task_copy",
          agent_id: "agent_eng_1"
        }
      }
    })
  );
  await queueA.next(); // ack
  await queueA.next(); // event

  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_replay_resolve",
      ts: Date.now(),
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
  await queueA.next(); // ack
  await queueA.next(); // event

  const page = serverA.getEventReplayPage({ cursor: 0, limit: 1 });
  assert.equal(page.events.length, 1);
  assert.equal(page.next_cursor, page.events[0].seq);
  assert.equal(page.has_more, true);

  const statsA = serverA.getEventTimelineStats();
  assert.ok(statsA.latest_seq >= 2);
  assert.equal(statsA.persist_path, eventLogPath);

  queueA.stop();
  wsA.close(1000, "test_done");
  await new Promise((resolve) => wsA.once("close", resolve));
  await serverA.stop();

  const serverB = createWorldServer({ eventLogPath });
  const { port: portB } = await serverB.start();
  const replayed = serverB.getEventReplayPage({ cursor: 0, limit: 10 });
  assert.ok(replayed.events.length >= 2);
  assert.equal(replayed.events[0].seq, 1);
  assert.ok(replayed.latest_seq >= replayed.events[replayed.events.length - 1].seq);

  const wsB = new WebSocket(`ws://127.0.0.1:${portB}/ws/world`);
  await new Promise((resolve) => wsB.once("open", resolve));
  const queueB = createMessageQueue(wsB);
  wsB.send(
    JSON.stringify({
      type: "hello",
      id: "hello_replay_b",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        },
        resume: {
          last_seq: 1,
          last_snapshot_id: "snap_1"
        }
      }
    })
  );
  const helloAckB = await queueB.next();
  assert.equal(helloAckB.type, "hello_ack");
  assert.equal(helloAckB.payload.resume.status, "resumed");
  assert.equal(helloAckB.payload.resume.replay_from_seq, 2);

  wsB.send(
    JSON.stringify({
      type: "subscribe",
      id: "sub_replay_b",
      ts: Date.now(),
      v: 1,
      payload: {
        scene_id: "cozy_office_v0",
        channels: {
          events: true,
          snapshots: false,
          goals: false,
          chat: false
        }
      }
    })
  );
  assert.equal((await queueB.next()).type, "snapshot");
  const replayEvent = await queueB.next();
  assert.equal(replayEvent.type, "event");
  assert.ok(replayEvent.payload.seq >= 2);

  const replayStats = serverB.getReplayResyncStats();
  assert.equal(replayStats.resume_attempts >= 1, true);
  assert.equal(replayStats.resume_success >= 1, true);

  queueB.stop();
  wsB.close(1000, "test_done");
  await new Promise((resolve) => wsB.once("close", resolve));
  await serverB.stop();
}

async function testResumeFallbackForStaleCursor() {
  const server = createWorldServer({ eventBufferSize: 4, replayLimit: 4 });
  const { port } = await server.start();
  const wsSeed = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => wsSeed.once("open", resolve));
  const seedQueue = createMessageQueue(wsSeed);

  wsSeed.send(
    JSON.stringify({
      type: "hello",
      id: "hello_seed",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await seedQueue.next();

  for (let index = 0; index < 5; index += 1) {
    wsSeed.send(
      JSON.stringify({
        type: "command",
        id: `cmd_seed_${index}`,
        ts: Date.now(),
        v: 1,
        payload: {
          name: "submit_request",
          data: {
            text: `seed request ${index}`
          }
        }
      })
    );
    await seedQueue.next(); // ack
  }

  seedQueue.stop();
  wsSeed.close(1000, "test_done");
  await new Promise((resolve) => wsSeed.once("close", resolve));

  const wsResume = new WebSocket(`ws://127.0.0.1:${port}/ws/world`);
  await new Promise((resolve) => wsResume.once("open", resolve));
  const resumeQueue = createMessageQueue(wsResume);
  wsResume.send(
    JSON.stringify({
      type: "hello",
      id: "hello_stale",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        },
        resume: {
          last_seq: 1,
          last_snapshot_id: "snap_old"
        }
      }
    })
  );
  const helloAck = await resumeQueue.next();
  assert.equal(helloAck.type, "hello_ack");
  assert.equal(helloAck.payload.resume.status, "snapshot_required");
  assert.equal(helloAck.payload.resume.reason, "CURSOR_STALE");

  const replayStats = server.getReplayResyncStats();
  assert.equal(replayStats.resume_fallback >= 1, true);
  assert.equal(replayStats.fallback_reasons.CURSOR_STALE >= 1, true);

  resumeQueue.stop();
  wsResume.close(1000, "test_done");
  await new Promise((resolve) => wsResume.once("close", resolve));
  await server.stop();
}

async function testStateRestorationBootstrapAndConsistencyGate() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "officeclaw-state-restore-"));
  const commandJournalPath = path.join(tempDir, "commands.jsonl");

  const serverA = createWorldServer({ commandJournalPath });
  const { port: portA } = await serverA.start();
  const wsA = new WebSocket(`ws://127.0.0.1:${portA}/ws/world`);
  await new Promise((resolve) => wsA.once("open", resolve));
  const queueA = createMessageQueue(wsA);

  wsA.send(
    JSON.stringify({
      type: "hello",
      id: "hello_restore_a",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await queueA.next();

  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_restore_assign",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "assign_task",
        data: {
          task_id: "task_copy",
          agent_id: "agent_eng_1"
        }
      }
    })
  );
  await queueA.next();
  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_restore_resolve",
      ts: Date.now(),
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
  await queueA.next();
  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_restore_cancel",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "cancel_task",
        data: {
          task_id: "task_copy",
          confirm: true
        }
      }
    })
  );
  await queueA.next();
  wsA.send(
    JSON.stringify({
      type: "command",
      id: "cmd_restore_approve",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "approve_artifact",
        data: {
          artifact_id: "art_research_report_v1"
        }
      }
    })
  );
  await queueA.next();

  queueA.stop();
  wsA.close(1000, "test_done");
  await new Promise((resolve) => wsA.once("close", resolve));
  await serverA.stop();

  const serverB = createWorldServer({ commandJournalPath });
  await serverB.start();
  const restoreStats = serverB.getStateRestorationStats();
  assert.equal(restoreStats.ready, true);
  assert.equal(restoreStats.consistency_ok, true);
  assert.equal(restoreStats.replayed_ok >= 4, true);

  const restoredSnapshot = serverB.getSnapshot();
  const restoredDecision = restoredSnapshot.decisions.find((item) => item.decision_id === "dec_audience");
  assert.equal(restoredDecision.status, "resolved");
  const restoredTask = restoredSnapshot.tasks.find((item) => item.task_id === "task_copy");
  assert.equal(restoredTask.status, "cancelled");
  const restoredProject = restoredSnapshot.projects.find((item) => item.project_id === "proj_abc");
  assert.equal(restoredProject.status, "completed");
  const restoredDecor = restoredSnapshot.office_decor.filter(
    (item) => item.unlocked_by_project_id === "proj_abc"
  );
  assert.equal(restoredDecor.length, 1);
  assert.equal(restoredDecor[0].anchor_id, "trophy_shelf_02");
  assert.equal(restoredDecor[0].outcome, "artifact_approved");
  await serverB.stop();

  const inconsistentJournalPath = path.join(tempDir, "commands-bad.jsonl");
  fs.writeFileSync(
    inconsistentJournalPath,
    `${JSON.stringify({
      journal_seq: 1,
      ts: Date.now(),
      command: { name: "unknown_command", data: {} }
    })}\n`
  );
  const serverC = createWorldServer({ commandJournalPath: inconsistentJournalPath });
  const { port: portC } = await serverC.start();
  const statsC = serverC.getStateRestorationStats();
  assert.equal(statsC.consistency_ok, false);

  const wsC = new WebSocket(`ws://127.0.0.1:${portC}/ws/world`);
  await new Promise((resolve) => wsC.once("open", resolve));
  const queueC = createMessageQueue(wsC);
  wsC.send(
    JSON.stringify({
      type: "hello",
      id: "hello_restore_c",
      ts: Date.now(),
      v: 1,
      payload: {
        client: {
          name: "officeclaw-web",
          build: "test",
          platform: "web"
        }
      }
    })
  );
  await queueC.next();
  wsC.send(
    JSON.stringify({
      type: "command",
      id: "cmd_blocked_after_restore",
      ts: Date.now(),
      v: 1,
      payload: {
        name: "assign_task",
        data: {
          task_id: "task_copy",
          agent_id: "agent_eng_1"
        }
      }
    })
  );
  const blocked = await queueC.next();
  assert.equal(blocked.type, "error");
  assert.equal(blocked.payload.code, "NOT_ALLOWED");

  queueC.stop();
  wsC.close(1000, "test_done");
  await new Promise((resolve) => wsC.once("close", resolve));
  await serverC.stop();
}

async function run() {
  await testSimulationStatsExposed();
  await testLowRateSnapshotPublisher();
  await testAgentStreamPassthroughChannelGating();
  await testTaskProgressPreviewSafetyAndRateLimit();
  await testHelloSubscribeLifecycle();
  await testInvalidHandshakeError();
  await testMalformedHelloError();
  await testCommandRouterAckAndError();
  await testCommandRateLimiting();
  await testOverrideControlCommandsAndEvents();
  await testObservabilityStatsAndAlerts();
  await testPrivacyDiagnosticsExportDefaults();
  await testSemanticEventTimelineOrdering();
  await testReplayCursorApiAndDurableEventLog();
  await testResumeFallbackForStaleCursor();
  await testStateRestorationBootstrapAndConsistencyGate();
  console.log("server-world websocket lifecycle tests passed.");
}

run();
