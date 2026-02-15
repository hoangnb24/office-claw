# OpenClaw Gateway Client (`bd-1nq`)

## Scope
Implements a reusable client for OpenClaw Gateway `POST /v1/chat/completions` with:
- required routing headers
- non-streaming JSON completion handling
- streaming SSE chunk handling

## Package
- `packages/openclaw-gateway/src/openclawGatewayClient.mjs`
- `packages/openclaw-gateway/src/index.mjs`
- `packages/openclaw-gateway/test/openclawGatewayClient.test.mjs`

## API
- `createOpenClawGatewayClient({ baseUrl, apiKey?, timeoutMs?, fetchImpl? })`
  - `chatCompletions({ agentId, sessionKey, model, messages, ...rest })`
  - `streamChatCompletions({ agentId, sessionKey, model, messages, ...rest })`
  - `getResilienceState()` for runtime circuit/retry visibility

Headers sent on each request:
- `x-openclaw-agent-id`
- `x-openclaw-session-key`
- `authorization: Bearer <apiKey>` when configured

## Streaming behavior
- Parses Server-Sent Events (`data: ...`) from response body.
- Yields `{ type: "chunk", data }` for JSON or raw data payloads.
- Yields `{ type: "done" }` on `[DONE]`.

## Error behavior
- Throws `OpenClawGatewayHttpError` for non-2xx responses with status/body/request-id context.
- Throws `OpenClawGatewayError` for timeout and invalid JSON response payloads.
- Throws `OpenClawGatewayRetryExhaustedError` when retryable failures exceed configured attempts.
- Throws `OpenClawGatewayCircuitOpenError` when circuit breaker is open.

## Validation
- `npm --prefix packages/openclaw-gateway test`

See `docs/openclaw-gateway-resilience.md` for retry/backoff/circuit-breaker policy details.
