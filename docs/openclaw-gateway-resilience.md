# OpenClaw Gateway Resilience Policy (`bd-2zr`)

## Scope
Defines bounded retry/backoff, timeout, and circuit-breaker behavior for gateway chat completion calls.

## Default policy
- `maxRetries`: `2` (total attempts = initial + 2 retries)
- `initialBackoffMs`: `200`
- `maxBackoffMs`: `2000`
- `backoffMultiplier`: `2`
- `retryableStatuses`: `408, 425, 429, 500, 502, 503, 504`
- `circuitFailureThreshold`: `4` consecutive terminal request failures
- `circuitCooldownMs`: `15000`

## Retry behavior
- Retries only retryable classes (retryable HTTP status or transport/timeout errors).
- Non-retryable 4xx failures fail fast (no retry loop).
- On retry exhaustion, throws `OpenClawGatewayRetryExhaustedError` with:
  - `attempts`
  - `failureClass`
  - `lastError`

## Terminal failure classification
- `rate_limited`: HTTP `429`
- `timeout`: transport timeout or HTTP `408`
- `upstream_unavailable`: HTTP `5xx`
- `validation_failed`: HTTP `4xx` (except specific mapped classes)
- `not_allowed`: HTTP `401/403`
- `not_found`: HTTP `404`
- `conflict`: HTTP `409`
- `transport_error`: non-HTTP transport/runtime failures
- `unknown`: uncategorized edge case

## Circuit breaker behavior
- States: `closed` -> `open` -> `half_open` -> `closed/open`.
- Opens when consecutive terminal failures reach threshold.
- While open and cooldown not elapsed, throws `OpenClawGatewayCircuitOpenError` immediately.
- After cooldown, first request enters `half_open`:
  - success closes and resets counters
  - failure re-opens circuit immediately

## Validation
- `npm --prefix packages/openclaw-gateway test`
