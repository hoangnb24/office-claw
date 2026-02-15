const DEFAULT_SENSITIVE_KEYS = Object.freeze([
  "text",
  "instructions",
  "prompt",
  "choice",
  "session_key",
  "token",
  "secret",
  "authorization",
  "api_key",
  "content",
  "body"
]);

const REDACTED_VALUE = "[REDACTED]";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSensitiveKeys(additionalSensitiveKeys = []) {
  return new Set(
    [...DEFAULT_SENSITIVE_KEYS, ...additionalSensitiveKeys]
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function redactPrimitive(value, key, sensitiveKeys) {
  if (typeof key === "string" && sensitiveKeys.has(key.toLowerCase())) {
    return REDACTED_VALUE;
  }
  return value;
}

function redactAny(value, sensitiveKeys, key = null) {
  if (Array.isArray(value)) {
    return value.map((item) => redactAny(item, sensitiveKeys, key));
  }
  if (isObject(value)) {
    const redacted = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      redacted[childKey] = redactAny(childValue, sensitiveKeys, childKey);
    }
    return redacted;
  }
  return redactPrimitive(value, key, sensitiveKeys);
}

export function redactStructuredPayload(payload, { additionalSensitiveKeys = [] } = {}) {
  const sensitiveKeys = normalizeSensitiveKeys(additionalSensitiveKeys);
  return redactAny(payload, sensitiveKeys);
}

export function pruneEntries(
  entries,
  {
    maxEntries = 2000,
    maxAgeMs = 24 * 60 * 60 * 1000,
    getTimestamp = (entry) => entry?.ts,
    now = Date.now
  } = {}
) {
  const nowTs = typeof now === "function" ? now() : Date.now();
  const boundedMaxEntries = Number.isFinite(maxEntries) ? Math.max(1, Math.floor(maxEntries)) : 2000;
  const boundedMaxAgeMs = Number.isFinite(maxAgeMs)
    ? Math.max(1, Math.floor(maxAgeMs))
    : 24 * 60 * 60 * 1000;

  const filtered = entries.filter((entry) => {
    const ts = Number(getTimestamp(entry));
    return Number.isFinite(ts) && nowTs - ts <= boundedMaxAgeMs;
  });

  if (filtered.length <= boundedMaxEntries) {
    return filtered;
  }
  return filtered.slice(filtered.length - boundedMaxEntries);
}

export function createSafeExportBundle(
  { lifecycleLog = [], observability = {}, eventTimeline = [], artifacts = [] } = {},
  {
    includeSensitive = false,
    maxLifecycleEntries = 2000,
    maxEventEntries = 2000,
    now = Date.now
  } = {}
) {
  const lifecycleBounded = lifecycleLog.slice(Math.max(0, lifecycleLog.length - maxLifecycleEntries));
  const eventsBounded = eventTimeline.slice(Math.max(0, eventTimeline.length - maxEventEntries));
  const artifactsBounded = artifacts.slice(0);

  if (includeSensitive) {
    return {
      exported_at_ts: typeof now === "function" ? now() : Date.now(),
      include_sensitive: true,
      lifecycle_log: lifecycleBounded,
      observability,
      event_timeline: eventsBounded,
      artifacts: artifactsBounded
    };
  }

  return {
    exported_at_ts: typeof now === "function" ? now() : Date.now(),
    include_sensitive: false,
    lifecycle_log: redactStructuredPayload(lifecycleBounded),
    observability: redactStructuredPayload(observability),
    event_timeline: redactStructuredPayload(eventsBounded),
    artifacts: redactStructuredPayload(artifactsBounded)
  };
}
