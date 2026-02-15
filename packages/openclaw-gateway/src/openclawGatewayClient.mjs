const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function normalizeBaseUrl(baseUrl) {
  assertNonEmptyString(baseUrl, "baseUrl");
  return baseUrl.replace(/\/+$/, "");
}

function normalizeCompletionInput(input, stream) {
  if (!input || typeof input !== "object") {
    throw new Error("Chat completion input must be an object");
  }

  const {
    agentId,
    sessionKey,
    model,
    messages,
    stream: _ignoredStream,
    ...rest
  } = input;

  assertNonEmptyString(agentId, "agentId");
  assertNonEmptyString(sessionKey, "sessionKey");
  assertNonEmptyString(model, "model");
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array");
  }

  return {
    agentId,
    sessionKey,
    payload: {
      model,
      messages,
      stream,
      ...rest
    }
  };
}

function normalizeResiliencePolicy(input) {
  const policy = {
    maxRetries: input?.maxRetries ?? 2,
    initialBackoffMs: input?.initialBackoffMs ?? 200,
    maxBackoffMs: input?.maxBackoffMs ?? 2000,
    backoffMultiplier: input?.backoffMultiplier ?? 2,
    retryableStatuses:
      input?.retryableStatuses && Array.isArray(input.retryableStatuses)
        ? new Set(input.retryableStatuses)
        : new Set(DEFAULT_RETRYABLE_HTTP_STATUSES),
    circuitFailureThreshold: input?.circuitFailureThreshold ?? 4,
    circuitCooldownMs: input?.circuitCooldownMs ?? 15000
  };

  if (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 0) {
    throw new Error("resilience.maxRetries must be an integer >= 0");
  }
  if (typeof policy.initialBackoffMs !== "number" || policy.initialBackoffMs <= 0) {
    throw new Error("resilience.initialBackoffMs must be > 0");
  }
  if (typeof policy.maxBackoffMs !== "number" || policy.maxBackoffMs <= 0) {
    throw new Error("resilience.maxBackoffMs must be > 0");
  }
  if (typeof policy.backoffMultiplier !== "number" || policy.backoffMultiplier < 1) {
    throw new Error("resilience.backoffMultiplier must be >= 1");
  }
  if (
    !Number.isInteger(policy.circuitFailureThreshold) ||
    policy.circuitFailureThreshold < 1
  ) {
    throw new Error("resilience.circuitFailureThreshold must be an integer >= 1");
  }
  if (typeof policy.circuitCooldownMs !== "number" || policy.circuitCooldownMs <= 0) {
    throw new Error("resilience.circuitCooldownMs must be > 0");
  }

  return policy;
}

function buildHeaders({ agentId, sessionKey, apiKey, accept }) {
  const headers = {
    "content-type": "application/json",
    accept,
    "x-openclaw-agent-id": agentId,
    "x-openclaw-session-key": sessionKey
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function readTextSafe(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJsonSafe(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function defaultSleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(fetchImpl, url, requestInit, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...requestInit,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenClawGatewayError(`Gateway request timed out after ${timeoutMs}ms`, {
        cause: error
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHttpErrorBody(rawBody) {
  const parsed = parseJsonSafe(rawBody);
  if (!parsed) {
    return rawBody || null;
  }
  if (typeof parsed.error?.message === "string") {
    return parsed.error.message;
  }
  return parsed;
}

function parseSseEventBlock(block) {
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n").trim();
  if (payload === "[DONE]") {
    return {
      type: "done"
    };
  }

  const parsed = parseJsonSafe(payload);
  return {
    type: "chunk",
    data: parsed ?? payload
  };
}

async function* iterateSseEvents(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const separatorIndex = buffer.indexOf("\n\n");
      if (separatorIndex < 0) {
        break;
      }

      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const event = parseSseEventBlock(block);
      if (!event) {
        continue;
      }

      yield event;
      if (event.type === "done") {
        return;
      }
    }
  }

  buffer += decoder.decode();
  const trailing = parseSseEventBlock(buffer);
  if (trailing) {
    yield trailing;
  }
}

function failureClassFromError(error) {
  if (error instanceof OpenClawGatewayHttpError) {
    if (error.status === 429) {
      return "rate_limited";
    }
    if (error.status === 408) {
      return "timeout";
    }
    if (error.status >= 500) {
      return "upstream_unavailable";
    }
    if (error.status === 409) {
      return "conflict";
    }
    if (error.status === 404) {
      return "not_found";
    }
    if (error.status === 401 || error.status === 403) {
      return "not_allowed";
    }
    if (error.status >= 400 && error.status < 500) {
      return "validation_failed";
    }
    return "http_error";
  }

  if (error instanceof OpenClawGatewayError) {
    if (error.message.toLowerCase().includes("timed out")) {
      return "timeout";
    }
    return "transport_error";
  }

  return "unknown";
}

function computeBackoffMs(policy, retryIndex) {
  const raw = policy.initialBackoffMs * policy.backoffMultiplier ** retryIndex;
  return Math.min(policy.maxBackoffMs, raw);
}

function asGatewayError(error) {
  if (error instanceof OpenClawGatewayError) {
    return error;
  }
  if (error instanceof Error) {
    return new OpenClawGatewayError(`Gateway transport error: ${error.message}`, { cause: error });
  }
  return new OpenClawGatewayError(`Gateway transport error: ${String(error)}`);
}

function isRetryableError(error, policy) {
  if (error instanceof OpenClawGatewayHttpError) {
    return policy.retryableStatuses.has(error.status);
  }
  if (error instanceof OpenClawGatewayCircuitOpenError) {
    return false;
  }
  if (error instanceof OpenClawGatewayRetryExhaustedError) {
    return false;
  }
  return true;
}

export class OpenClawGatewayError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "OpenClawGatewayError";
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export class OpenClawGatewayHttpError extends OpenClawGatewayError {
  constructor({ status, statusText, body, requestId }) {
    super(`Gateway request failed (${status} ${statusText || "unknown"})`);
    this.name = "OpenClawGatewayHttpError";
    this.status = status;
    this.statusText = statusText || "";
    this.body = body;
    this.requestId = requestId || null;
  }
}

export class OpenClawGatewayRetryExhaustedError extends OpenClawGatewayError {
  constructor({ attempts, lastError, failureClass }) {
    super(`Gateway retries exhausted after ${attempts} attempt(s) [${failureClass}]`, {
      cause: lastError
    });
    this.name = "OpenClawGatewayRetryExhaustedError";
    this.attempts = attempts;
    this.failureClass = failureClass;
    this.lastError = lastError;
  }
}

export class OpenClawGatewayCircuitOpenError extends OpenClawGatewayError {
  constructor({ retryAfterMs, failureCount, threshold }) {
    super(`Gateway circuit is open (retry in ${retryAfterMs}ms)`);
    this.name = "OpenClawGatewayCircuitOpenError";
    this.retryAfterMs = retryAfterMs;
    this.failureCount = failureCount;
    this.threshold = threshold;
  }
}

export function createOpenClawGatewayClient({
  baseUrl,
  apiKey = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  resilience = {},
  fetchImpl = globalThis.fetch,
  sleepImpl = defaultSleep,
  now = () => Date.now()
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const policy = normalizeResiliencePolicy(resilience);

  if (typeof fetchImpl !== "function") {
    throw new Error("fetchImpl must be a function");
  }
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive number");
  }
  if (typeof sleepImpl !== "function") {
    throw new Error("sleepImpl must be a function");
  }
  if (typeof now !== "function") {
    throw new Error("now must be a function");
  }

  let circuitState = "closed";
  let consecutiveFailures = 0;
  let circuitOpenedAt = 0;

  function resetCircuit() {
    circuitState = "closed";
    consecutiveFailures = 0;
    circuitOpenedAt = 0;
  }

  function markFailure() {
    if (circuitState === "half_open") {
      circuitState = "open";
      consecutiveFailures = Math.max(consecutiveFailures, policy.circuitFailureThreshold);
      circuitOpenedAt = now();
      return;
    }

    consecutiveFailures += 1;
    if (consecutiveFailures >= policy.circuitFailureThreshold) {
      circuitState = "open";
      circuitOpenedAt = now();
    }
  }

  function assertCircuitAllowsRequest() {
    if (circuitState !== "open") {
      return;
    }
    const elapsed = now() - circuitOpenedAt;
    if (elapsed >= policy.circuitCooldownMs) {
      circuitState = "half_open";
      return;
    }
    throw new OpenClawGatewayCircuitOpenError({
      retryAfterMs: Math.max(1, policy.circuitCooldownMs - elapsed),
      failureCount: consecutiveFailures,
      threshold: policy.circuitFailureThreshold
    });
  }

  async function fetchGatewayResponse({ payload, agentId, sessionKey, accept }) {
    assertCircuitAllowsRequest();

    let attempts = 0;
    let retryIndex = 0;

    while (true) {
      attempts += 1;

      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          `${normalizedBaseUrl}${CHAT_COMPLETIONS_PATH}`,
          {
            method: "POST",
            headers: buildHeaders({
              agentId,
              sessionKey,
              apiKey,
              accept
            }),
            body: JSON.stringify(payload)
          },
          timeoutMs
        );

        if (!response.ok) {
          const rawBody = await readTextSafe(response);
          throw new OpenClawGatewayHttpError({
            status: response.status,
            statusText: response.statusText,
            body: normalizeHttpErrorBody(rawBody),
            requestId: response.headers.get("x-request-id")
          });
        }

        resetCircuit();
        return response;
      } catch (error) {
        const gatewayError = asGatewayError(error);
        const retryable = isRetryableError(gatewayError, policy);
        const canRetry = retryable && attempts <= policy.maxRetries;

        if (!canRetry) {
          markFailure();
          if (retryable && attempts > 1) {
            throw new OpenClawGatewayRetryExhaustedError({
              attempts,
              lastError: gatewayError,
              failureClass: failureClassFromError(gatewayError)
            });
          }
          throw gatewayError;
        }

        const delayMs = computeBackoffMs(policy, retryIndex);
        retryIndex += 1;
        await sleepImpl(delayMs);
      }
    }
  }

  return {
    async chatCompletions(input) {
      const normalized = normalizeCompletionInput(input, false);
      const response = await fetchGatewayResponse({
        payload: normalized.payload,
        agentId: normalized.agentId,
        sessionKey: normalized.sessionKey,
        accept: "application/json"
      });

      const responseBody = await readTextSafe(response);
      const parsed = parseJsonSafe(responseBody);
      if (!parsed) {
        throw new OpenClawGatewayError("Gateway returned non-JSON completion response");
      }
      return parsed;
    },

    async *streamChatCompletions(input) {
      const normalized = normalizeCompletionInput(input, true);
      const response = await fetchGatewayResponse({
        payload: normalized.payload,
        agentId: normalized.agentId,
        sessionKey: normalized.sessionKey,
        accept: "text/event-stream"
      });

      if (!response.body) {
        throw new OpenClawGatewayError("Gateway streaming response did not include a body");
      }

      for await (const event of iterateSseEvents(response.body)) {
        yield event;
        if (event.type === "done") {
          return;
        }
      }
    },

    getResilienceState() {
      return {
        circuitState,
        consecutiveFailures,
        circuitOpenedAt,
        policy: {
          ...policy,
          retryableStatuses: [...policy.retryableStatuses]
        }
      };
    }
  };
}

export const OPENCLAW_GATEWAY_DEFAULTS = Object.freeze({
  path: CHAT_COMPLETIONS_PATH,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  resilience: {
    maxRetries: 2,
    initialBackoffMs: 200,
    maxBackoffMs: 2000,
    backoffMultiplier: 2,
    retryableStatuses: [...DEFAULT_RETRYABLE_HTTP_STATUSES],
    circuitFailureThreshold: 4,
    circuitCooldownMs: 15000
  }
});
