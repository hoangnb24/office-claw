import test from "node:test";
import assert from "node:assert/strict";
import {
  createOpenClawGatewayClient,
  OpenClawGatewayCircuitOpenError,
  OpenClawGatewayError,
  OpenClawGatewayHttpError,
  OpenClawGatewayRetryExhaustedError
} from "../src/index.mjs";

function makeJsonResponse(body, status = 200, statusText = "OK", headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}

function makeSseResponse(chunks, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    status,
    headers: {
      "content-type": "text/event-stream"
    }
  });
}

function makeClient(fetchImpl, overrides = {}) {
  return createOpenClawGatewayClient({
    baseUrl: "https://gateway.local",
    apiKey: "sk_test",
    fetchImpl,
    ...overrides
  });
}

function completionInput() {
  return {
    agentId: "agent_bd",
    sessionKey: "agent:agent_bd:officeclaw:channel:proj_alpha",
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hello" }]
  };
}

test("chatCompletions sends required headers and parses JSON response", async () => {
  let requestUrl = null;
  let requestInit = null;
  const fetchImpl = async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return makeJsonResponse({
      id: "cmpl_1",
      choices: [{ message: { role: "assistant", content: "ok" } }]
    });
  };

  const client = makeClient(fetchImpl);
  const result = await client.chatCompletions(completionInput());

  assert.equal(requestUrl, "https://gateway.local/v1/chat/completions");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.headers["x-openclaw-agent-id"], "agent_bd");
  assert.equal(
    requestInit.headers["x-openclaw-session-key"],
    "agent:agent_bd:officeclaw:channel:proj_alpha"
  );
  assert.equal(requestInit.headers.authorization, "Bearer sk_test");
  assert.equal(result.id, "cmpl_1");
  assert.equal(JSON.parse(requestInit.body).stream, false);
});

test("retryable failures use bounded backoff and recover on success", async () => {
  const sleepCalls = [];
  let callCount = 0;

  const fetchImpl = async () => {
    callCount += 1;
    if (callCount < 3) {
      return makeJsonResponse(
        { error: { message: "upstream temporary failure" } },
        503,
        "Service Unavailable"
      );
    }
    return makeJsonResponse({ id: "cmpl_after_retry" });
  };

  const client = makeClient(fetchImpl, {
    resilience: {
      maxRetries: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 40,
      backoffMultiplier: 2
    },
    sleepImpl: async (ms) => {
      sleepCalls.push(ms);
    }
  });

  const result = await client.chatCompletions(completionInput());
  assert.equal(result.id, "cmpl_after_retry");
  assert.equal(callCount, 3);
  assert.deepEqual(sleepCalls, [10, 20]);
});

test("non-retryable 4xx errors fail immediately", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return makeJsonResponse(
      {
        error: {
          message: "validation failed"
        }
      },
      422,
      "Unprocessable Entity",
      { "x-request-id": "req_123" }
    );
  };

  const client = makeClient(fetchImpl);
  await assert.rejects(
    () => client.chatCompletions(completionInput()),
    (error) => {
      assert.ok(error instanceof OpenClawGatewayHttpError);
      assert.equal(error.status, 422);
      assert.equal(error.requestId, "req_123");
      assert.equal(error.body, "validation failed");
      return true;
    }
  );
  assert.equal(callCount, 1);
});

test("retry exhaustion raises terminal failure classification", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return makeJsonResponse(
      { error: { message: "still down" } },
      503,
      "Service Unavailable"
    );
  };

  const client = makeClient(fetchImpl, {
    resilience: {
      maxRetries: 1,
      initialBackoffMs: 1,
      maxBackoffMs: 1
    },
    sleepImpl: async () => {}
  });

  await assert.rejects(
    () => client.chatCompletions(completionInput()),
    (error) => {
      assert.ok(error instanceof OpenClawGatewayRetryExhaustedError);
      assert.equal(error.attempts, 2);
      assert.equal(error.failureClass, "upstream_unavailable");
      return true;
    }
  );
  assert.equal(callCount, 2);
});

test("circuit breaker opens after repeated failures and recovers after cooldown", async () => {
  let nowValue = 0;
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    if (callCount <= 2) {
      return makeJsonResponse({ error: { message: "down" } }, 503, "Service Unavailable");
    }
    return makeJsonResponse({ id: "cmpl_after_cooldown" });
  };

  const client = makeClient(fetchImpl, {
    now: () => nowValue,
    sleepImpl: async () => {},
    resilience: {
      maxRetries: 0,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 1000
    }
  });

  await assert.rejects(() => client.chatCompletions(completionInput()), OpenClawGatewayHttpError);
  await assert.rejects(() => client.chatCompletions(completionInput()), OpenClawGatewayHttpError);

  await assert.rejects(
    () => client.chatCompletions(completionInput()),
    (error) => {
      assert.ok(error instanceof OpenClawGatewayCircuitOpenError);
      assert.equal(error.threshold, 2);
      return true;
    }
  );

  assert.equal(callCount, 2);

  nowValue += 1000;
  const result = await client.chatCompletions(completionInput());
  assert.equal(result.id, "cmpl_after_cooldown");
  assert.equal(client.getResilienceState().circuitState, "closed");
});

test("streamChatCompletions parses SSE chunks and done sentinel", async () => {
  const fetchImpl = async () =>
    makeSseResponse([
      "data: {\"id\":\"chunk_1\",\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\n",
      "data: {\"id\":\"chunk_2\",\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n",
      "data: [DONE]\n\n"
    ]);

  const client = makeClient(fetchImpl);
  const events = [];
  for await (const event of client.streamChatCompletions(completionInput())) {
    events.push(event);
  }

  assert.equal(events.length, 3);
  assert.equal(events[0].type, "chunk");
  assert.equal(events[0].data.id, "chunk_1");
  assert.equal(events[1].data.id, "chunk_2");
  assert.equal(events[2].type, "done");
});

test("chatCompletions fails if gateway returns non-JSON body", async () => {
  const fetchImpl = async () =>
    new Response("not json", {
      status: 200,
      headers: {
        "content-type": "text/plain"
      }
    });

  const client = makeClient(fetchImpl);
  await assert.rejects(
    () => client.chatCompletions(completionInput()),
    (error) => {
      assert.ok(error instanceof OpenClawGatewayError);
      assert.match(error.message, /non-JSON/i);
      return true;
    }
  );
});
