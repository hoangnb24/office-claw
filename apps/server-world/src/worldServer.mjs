import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { createCommandRouter } from "./commandRouter.mjs";
import { createEventTimeline } from "./eventTimeline.mjs";
import {
  createSafeExportBundle,
  pruneEntries,
  redactStructuredPayload
} from "./privacyControls.mjs";
import { createStateRestorationPipeline } from "./stateRestore.mjs";
import {
  createSimulationRuntime,
  MIN_TICK_RATE_HZ,
  MAX_TICK_RATE_HZ
} from "./simulation.mjs";

function nowTs() {
  return Date.now();
}

const MIN_SNAPSHOT_RATE_HZ = 2;
const MAX_SNAPSHOT_RATE_HZ = 5;
const ALLOWED_AGENT_STREAM_KINDS = new Set(["token", "thought", "code"]);
const TASK_PROGRESS_PREVIEW_MIN_INTERVAL_MS = 500;
const SAFE_TASK_PROGRESS_PREVIEW_BY_KIND = Object.freeze({
  token: Object.freeze([
    "Processing task context.",
    "Preparing concise progress update.",
    "Applying next execution step.",
    "Finalizing task output."
  ]),
  thought: Object.freeze([
    "Reviewing task status.",
    "Selecting next user-visible action.",
    "Refining execution plan.",
    "Finalizing task output."
  ]),
  code: Object.freeze([
    "Drafting implementation changes.",
    "Refining logic and safeguards.",
    "Preparing completion pass.",
    "Finalizing task output."
  ])
});
const DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS = Object.freeze({
  validation_failed: 10,
  rate_limited: 10,
  socket_errors: 3,
  restoration_blocked: 5,
  slow_tick_ms: 30,
  queue_latency_ms: 120
});

function clampSnapshotRateHz(value) {
  if (!Number.isFinite(value)) {
    return 3;
  }
  return Math.min(MAX_SNAPSHOT_RATE_HZ, Math.max(MIN_SNAPSHOT_RATE_HZ, Math.round(value)));
}

function messageId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function validateHello(payload) {
  const client = payload?.client;
  return (
    client &&
    typeof client.name === "string" &&
    typeof client.build === "string" &&
    typeof client.platform === "string"
  );
}

function validateSubscribe(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (typeof payload.scene_id !== "string" || !payload.scene_id) {
    return false;
  }
  if (!payload.channels || typeof payload.channels !== "object") {
    return false;
  }
  const channelKeys = ["events", "snapshots", "goals", "chat", "agent_stream"];
  return channelKeys.every(
    (key) =>
      payload.channels[key] === undefined ||
      typeof payload.channels[key] === "boolean"
  );
}

function parseIncoming(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sendEnvelope(session, type, payload, explicitId) {
  session.recordOutbound?.(type);
  session.ws.send(
    JSON.stringify({
      type,
      id: explicitId || messageId(type.replace(/[^a-z]/g, "")),
      ts: nowTs(),
      v: session.protocolVersion,
      payload
    })
  );
}

function sendProtocolError(session, inReplyTo, code, message) {
  session.recordServerError?.({
    code,
    message,
    in_reply_to: inReplyTo || "msg_unknown"
  });
  sendEnvelope(session, "error", {
    in_reply_to: inReplyTo || "msg_unknown",
    code,
    message
  });
}

function inferProjectId(commandPayload, snapshot) {
  const data = commandPayload?.data || {};
  if (typeof data.project_id === "string") {
    return data.project_id;
  }
  if (typeof data.task_id === "string") {
    const task = snapshot.tasks.find((item) => item.task_id === data.task_id);
    if (task?.project_id) {
      return task.project_id;
    }
  }
  if (typeof data.source_task_id === "string") {
    const sourceTask = snapshot.tasks.find((item) => item.task_id === data.source_task_id);
    if (sourceTask?.project_id) {
      return sourceTask.project_id;
    }
  }
  if (typeof data.artifact_id === "string") {
    const artifact = snapshot.artifacts.find((item) => item.artifact_id === data.artifact_id);
    if (artifact?.project_id) {
      return artifact.project_id;
    }
  }
  if (typeof data.decision_id === "string") {
    const decision = snapshot.decisions.find((item) => item.decision_id === data.decision_id);
    if (decision?.project_id) {
      return decision.project_id;
    }
  }
  return snapshot.projects[0]?.project_id || "proj_boot";
}

function buildSemanticEvents(commandPayload, inReplyTo, snapshot) {
  const data = commandPayload?.data || {};
  const projectId = inferProjectId(commandPayload, snapshot);
  const baseMeta = {
    in_reply_to: inReplyTo || "msg_unknown",
    command_name: commandPayload?.name || "unknown"
  };

  const withBase = (name, extra = {}) => ({
    name,
    project_id: projectId,
    ...extra,
    meta: {
      ...baseMeta,
      ...(extra.meta || {})
    }
  });

  switch (commandPayload?.name) {
    case "submit_request":
      return [withBase("kickoff_started"), withBase("tasks_created")];
    case "assign_task":
      return [
        withBase("task_assigned", {
          task_id: data.task_id,
          agent_id: data.agent_id
        })
      ];
    case "auto_assign":
      return [
        withBase("task_assigned", {
          meta: {
            assignment_mode: "auto"
          }
        })
      ];
    case "resolve_decision":
      return [
        withBase("decision_resolved", {
          decision_id: data.decision_id
        })
      ];
    case "approve_artifact": {
      const taskId =
        snapshot.artifacts.find((item) => item.artifact_id === data.artifact_id)?.task_id || null;
      const events = [
        withBase("review_approved", {
          artifact_id: data.artifact_id
        })
      ];
      if (taskId) {
        events.push(
          withBase("task_done", {
            task_id: taskId,
            artifact_id: data.artifact_id
          })
        );
      }
      return events;
    }
    case "request_changes":
      return [
        withBase("review_changes_requested", {
          artifact_id: data.artifact_id
        })
      ];
    case "split_into_tasks":
      return [
        withBase("tasks_created", {
          artifact_id: data.artifact_id
        })
      ];
    case "start_kickoff":
      return [withBase("kickoff_started")];
    case "reassign_task":
      return [
        withBase("task_reassigned", {
          task_id: data.task_id,
          agent_id: data.to_agent_id || null,
          meta: {
            from_agent_id: data.from_agent_id || null
          }
        })
      ];
    case "cancel_task":
      return [
        withBase("task_cancelled", {
          task_id: data.task_id
        })
      ];
    case "pause_project":
      return [
        withBase("project_paused", {
          meta: {
            scope: data.scope || "dispatch_only"
          }
        })
      ];
    case "resume_project":
      return [withBase("project_resumed")];
    case "rerun_task":
      return [
        withBase("tasks_created", {
          task_id: data.source_task_id,
          meta: {
            rerun_mode: data.mode || "clone_as_new"
          }
        })
      ];
    default:
      return [];
  }
}

export function createWorldServer({
  host = "127.0.0.1",
  port = 0,
  protocolVersion = 1,
  logger = console,
  tickRateHz = MIN_TICK_RATE_HZ,
  snapshotRateHz = 3,
  eventLogPath = null,
  eventBufferSize = 2000,
  replayLimit = 200,
  commandJournalPath = null,
  commandRateLimitMaxCommands = 12,
  commandRateLimitWindowMs = 5000,
  observabilityAlertThresholds = null,
  observabilityAlertHandler = null,
  diagnosticsRetentionMaxEntries = 2000,
  diagnosticsRetentionMaxAgeMs = 24 * 60 * 60 * 1000
} = {}) {
  const lifecycleLog = [];
  const sessions = new Map();
  const simulation = createSimulationRuntime({ tickRateHz });
  const configuredSnapshotRateHz = clampSnapshotRateHz(snapshotRateHz);
  const snapshotIntervalMs = Math.floor(1000 / configuredSnapshotRateHz);
  const boundedReplayLimit = Math.max(1, Math.floor(replayLimit));
  let snapshotTimer = null;
  let snapshotPublishCount = 0;
  let lastSnapshotPublishedTs = null;
  const eventTimeline = createEventTimeline({
    persistPath: eventLogPath,
    maxEvents: eventBufferSize
  });
  const replayResyncStats = {
    resume_attempts: 0,
    resume_success: 0,
    resume_fallback: 0,
    replayed_events: 0,
    fallback_reasons: {}
  };
  const commandSecurityStats = {
    rate_limited: 0,
    validation_failed: 0,
    sanitized_text_fields: 0
  };
  const observability = {
    started_ts: nowTs(),
    inbound_messages: {},
    outbound_messages: {},
    command: {
      attempted: 0,
      ok: 0,
      failed: 0,
      rate_limited: 0,
      blocked_by_restoration: 0
    },
    sessions: {
      connected: 0,
      disconnected: 0,
      socket_errors: 0
    },
    pipeline: {
      snapshots_published: 0,
      events_published: 0,
      agent_stream_published: 0
    },
    performance: {
      last_tick_duration_ms: 0,
      queue_latency_p95_ms: 0
    },
    errors_by_code: {},
    last_error: null,
    alerts_emitted: 0
  };
  const alertBuckets = {};
  const effectiveAlertThresholds = {
    ...DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS,
    ...(observabilityAlertThresholds && typeof observabilityAlertThresholds === "object"
      ? observabilityAlertThresholds
      : {})
  };
  const boundedDiagnosticsRetentionMaxEntries = Number.isFinite(diagnosticsRetentionMaxEntries)
    ? Math.max(1, Math.floor(diagnosticsRetentionMaxEntries))
    : 2000;
  const boundedDiagnosticsRetentionMaxAgeMs = Number.isFinite(diagnosticsRetentionMaxAgeMs)
    ? Math.max(1000, Math.floor(diagnosticsRetentionMaxAgeMs))
    : 24 * 60 * 60 * 1000;
  const recentErrors = [];
  const streamSeqById = new Map();
  const completedStreamIds = new Set();
  const taskProgressPreviewByTaskId = new Map();
  const boundedCommandRateLimitMax = Number.isFinite(commandRateLimitMaxCommands)
    ? Math.max(1, Math.floor(commandRateLimitMaxCommands))
    : 12;
  const boundedCommandRateLimitWindowMs = Number.isFinite(commandRateLimitWindowMs)
    ? Math.max(250, Math.floor(commandRateLimitWindowMs))
    : 5000;
  const commandRouter = createCommandRouter({
    commandHandler: (payload) => simulation.applyCommand(payload)
  });
  const restoration = createStateRestorationPipeline({
    commandJournalPath,
    simulation
  });

  function incrementBucket(map, key, amount = 1) {
    map[key] = (map[key] || 0) + amount;
    return map[key];
  }

  function emitStructuredLog(level, entry) {
    const safeEntry = redactStructuredPayload(entry);
    logger[level]?.("[server-world]", safeEntry);
    return safeEntry;
  }

  function applyDiagnosticsRetention() {
    const retainedLifecycle = pruneEntries(lifecycleLog, {
      maxEntries: boundedDiagnosticsRetentionMaxEntries,
      maxAgeMs: boundedDiagnosticsRetentionMaxAgeMs,
      getTimestamp: (entry) => entry?.ts,
      now: nowTs
    });
    lifecycleLog.splice(0, lifecycleLog.length, ...retainedLifecycle);

    const retainedErrors = pruneEntries(recentErrors, {
      maxEntries: boundedDiagnosticsRetentionMaxEntries,
      maxAgeMs: boundedDiagnosticsRetentionMaxAgeMs,
      getTimestamp: (entry) => entry?.ts,
      now: nowTs
    });
    recentErrors.splice(0, recentErrors.length, ...retainedErrors);
  }

  function emitAlert(alert) {
    observability.alerts_emitted += 1;
    emitStructuredLog("warn", {
      kind: "observability_alert",
      ...alert
    });
    if (typeof observabilityAlertHandler === "function") {
      try {
        observabilityAlertHandler(alert);
      } catch (error) {
        emitStructuredLog("warn", {
          kind: "observability_alert_handler_error",
          message: String(error?.message || error)
        });
      }
    }
  }

  function maybeEmitThresholdAlert({ key, value, threshold, severity = "warning", message }) {
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return;
    }
    const bucket = Math.floor(value / threshold);
    const priorBucket = alertBuckets[key] || 0;
    if (bucket > 0 && bucket > priorBucket) {
      alertBuckets[key] = bucket;
      emitAlert({
        key,
        severity,
        value,
        threshold,
        message,
        ts: nowTs()
      });
    }
  }

  function getPerformanceSignals() {
    const stats = simulation.getStats();
    const tickDurationMs = Number(stats?.tick_timing_ms?.last_tick_duration_ms ?? 0);
    const queueLatencyCommandP95 = Number(stats?.queue_latency_ms?.commands?.p95 ?? 0);
    const queueLatencyEventP95 = Number(stats?.queue_latency_ms?.events?.p95 ?? 0);
    const queueLatencyP95 = Math.max(queueLatencyCommandP95, queueLatencyEventP95);
    return {
      tickDurationMs,
      queueLatencyP95
    };
  }

  function maybeEmitPerformanceAlerts() {
    const perf = getPerformanceSignals();
    observability.performance.last_tick_duration_ms = perf.tickDurationMs;
    observability.performance.queue_latency_p95_ms = perf.queueLatencyP95;

    maybeEmitThresholdAlert({
      key: "slow_tick_ms",
      value: perf.tickDurationMs,
      threshold: Number(effectiveAlertThresholds.slow_tick_ms),
      message: "Simulation tick duration exceeded threshold."
    });
    maybeEmitThresholdAlert({
      key: "queue_latency_ms",
      value: perf.queueLatencyP95,
      threshold: Number(effectiveAlertThresholds.queue_latency_ms),
      message: "Simulation queue latency exceeded threshold."
    });
  }

  function recordInbound(type) {
    incrementBucket(observability.inbound_messages, type || "unknown");
  }

  function recordOutbound(type) {
    incrementBucket(observability.outbound_messages, type || "unknown");
  }

  function recordServerError({ code, message, in_reply_to, session_id }) {
    incrementBucket(observability.errors_by_code, code || "INTERNAL");
    observability.last_error = {
      ts: nowTs(),
      code: code || "INTERNAL",
      message: message || "unknown error",
      in_reply_to: in_reply_to || "msg_unknown",
      session_id: session_id || null
    };
    recentErrors.push(observability.last_error);
    applyDiagnosticsRetention();
    emitStructuredLog("warn", {
      kind: "protocol_error",
      ...observability.last_error
    });
  }

  function buildPublishedSnapshot(sceneId) {
    const snapshot = simulation.getSnapshot(sceneId);
    return {
      ...snapshot,
      snapshot_seq: snapshot.seq,
      correction: {
        mode: "ease",
        recommended_ease_ms: 200,
        hard_teleport_threshold_m: 2.5
      },
      publisher: {
        rate_hz: configuredSnapshotRateHz
      }
    };
  }

  function publishSnapshotsToSubscribers() {
    maybeEmitPerformanceAlerts();
    for (const session of sessions.values()) {
      if (!session.subscribed || !session.channels?.snapshots) {
        continue;
      }
      if (session.ws.readyState !== session.ws.OPEN) {
        continue;
      }
      const payload = buildPublishedSnapshot(session.sceneId || undefined);
      sendEnvelope(session, "snapshot", payload);
      snapshotPublishCount += 1;
      observability.pipeline.snapshots_published += 1;
      lastSnapshotPublishedTs = nowTs();
    }
  }

  function deliverEventsToSession(session, events) {
    if (!session.subscribed || !session.channels?.events) {
      return;
    }
    if (session.ws.readyState !== session.ws.OPEN) {
      return;
    }
    for (const event of events) {
      sendEnvelope(session, "event", event);
      observability.pipeline.events_published += 1;
      session.lastEventSeq = event.seq;
    }
  }

  function broadcastEvent(event) {
    for (const session of sessions.values()) {
      deliverEventsToSession(session, [event]);
    }
  }

  function normalizeAgentStreamPayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== "object") {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "agent_stream payload must be an object."
      };
    }

    const payload = rawPayload;
    const requiredStringFields = ["stream_id", "agent_id", "project_id", "task_id", "kind"];
    for (const field of requiredStringFields) {
      if (typeof payload[field] !== "string" || payload[field].trim().length === 0) {
        return {
          ok: false,
          code: "VALIDATION_FAILED",
          message: `agent_stream.${field} must be a non-empty string.`
        };
      }
    }
    if (!ALLOWED_AGENT_STREAM_KINDS.has(payload.kind.trim().toLowerCase())) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "agent_stream.kind must be one of token|thought|code."
      };
    }
    if (typeof payload.delta !== "string") {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "agent_stream.delta must be a string."
      };
    }
    if (typeof payload.done !== "boolean") {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "agent_stream.done must be a boolean."
      };
    }

    const streamId = payload.stream_id.trim();
    if (completedStreamIds.has(streamId)) {
      return {
        ok: false,
        code: "CONFLICT",
        message: `agent_stream ${streamId} is already completed.`
      };
    }

    const currentSeq = streamSeqById.get(streamId) ?? 0;
    const requestedSeq =
      payload.seq === undefined ? currentSeq + 1 : Number(payload.seq);
    if (!Number.isInteger(requestedSeq) || requestedSeq < 1) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "agent_stream.seq must be an integer >= 1."
      };
    }
    if (requestedSeq <= currentSeq) {
      return {
        ok: false,
        code: "CONFLICT",
        message: `agent_stream.seq must increase monotonically for stream ${streamId}.`
      };
    }

    return {
      ok: true,
      payload: {
        stream_id: streamId,
        agent_id: payload.agent_id.trim(),
        project_id: payload.project_id.trim(),
        task_id: payload.task_id.trim(),
        kind: payload.kind.trim().toLowerCase(),
        seq: requestedSeq,
        delta: payload.delta,
        done: payload.done
      }
    };
  }

  function deliverAgentStreamToSession(session, payload) {
    if (!session.subscribed || !session.channels?.agent_stream) {
      return;
    }
    if (session.ws.readyState !== session.ws.OPEN) {
      return;
    }
    sendEnvelope(session, "agent_stream", payload);
    observability.pipeline.agent_stream_published += 1;
  }

  function broadcastAgentStream(payload) {
    for (const session of sessions.values()) {
      deliverAgentStreamToSession(session, payload);
    }
  }

  function normalizeProgressKind(kind) {
    if (typeof kind !== "string") {
      return "token";
    }
    const normalized = kind.trim().toLowerCase();
    if (SAFE_TASK_PROGRESS_PREVIEW_BY_KIND[normalized]) {
      return normalized;
    }
    return "token";
  }

  function taskProgressPreviewKey(projectId, taskId) {
    const normalizedProjectId =
      typeof projectId === "string" && projectId.length > 0 ? projectId : "proj_unknown";
    return `${normalizedProjectId}:${taskId}`;
  }

  function buildSafeTaskProgressPreview(payload) {
    const kind = normalizeProgressKind(payload.kind);
    const options = SAFE_TASK_PROGRESS_PREVIEW_BY_KIND[kind];
    const activeIndex = Math.max(
      0,
      Math.min(options.length - 2, Math.max(0, payload.seq - 1) % (options.length - 1))
    );
    const previewText = payload.done ? options[options.length - 1] : options[activeIndex];
    const percent = payload.done ? 99 : Math.max(5, Math.min(95, payload.seq * 8));
    return {
      kind,
      preview_text: previewText,
      percent
    };
  }

  function shouldEmitTaskProgressPreview(payload) {
    const now = nowTs();
    const key = taskProgressPreviewKey(payload.project_id, payload.task_id);
    const previous = taskProgressPreviewByTaskId.get(key);
    if (
      previous &&
      !payload.done &&
      now - previous.last_emitted_ts < TASK_PROGRESS_PREVIEW_MIN_INTERVAL_MS
    ) {
      return false;
    }
    taskProgressPreviewByTaskId.set(key, {
      last_emitted_ts: now,
      last_seq: payload.seq
    });
    if (payload.done) {
      taskProgressPreviewByTaskId.delete(key);
    }
    return true;
  }

  function publishTaskProgressPreview(payload) {
    if (!shouldEmitTaskProgressPreview(payload)) {
      return;
    }
    const preview = buildSafeTaskProgressPreview(payload);
    const appended = eventTimeline.append({
      name: "task_progress",
      project_id: payload.project_id,
      task_id: payload.task_id,
      agent_id: payload.agent_id,
      kind: preview.kind,
      percent: preview.percent,
      preview_text: preview.preview_text,
      meta: {
        source: "agent_stream",
        stream_id: payload.stream_id,
        seq: payload.seq
      }
    });
    broadcastEvent(appended);
  }

  function emitCommandEvents(commandPayload, inReplyTo) {
    const snapshot = simulation.getSnapshot();
    const semanticEvents = buildSemanticEvents(commandPayload, inReplyTo, snapshot);
    for (const eventPayload of semanticEvents) {
      const appended = eventTimeline.append(eventPayload);
      broadcastEvent(appended);
      if (
        typeof eventPayload?.task_id === "string" &&
        (eventPayload.name === "task_done" || eventPayload.name === "task_cancelled")
      ) {
        taskProgressPreviewByTaskId.delete(
          taskProgressPreviewKey(eventPayload.project_id, eventPayload.task_id)
        );
      }
    }
  }

  function recordFallback(reason) {
    replayResyncStats.resume_fallback += 1;
    replayResyncStats.fallback_reasons[reason] =
      (replayResyncStats.fallback_reasons[reason] || 0) + 1;
  }

  function consumeCommandQuota(session) {
    const now = nowTs();
    if (
      !session.commandRateWindowStartTs ||
      now - session.commandRateWindowStartTs >= boundedCommandRateLimitWindowMs
    ) {
      session.commandRateWindowStartTs = now;
      session.commandRateWindowCount = 0;
    }

    if (session.commandRateWindowCount >= boundedCommandRateLimitMax) {
      maybeEmitThresholdAlert({
        key: "rate_limited",
        value: commandSecurityStats.rate_limited + 1,
        threshold: Number(effectiveAlertThresholds.rate_limited),
        message: "Command rate-limits exceeded threshold."
      });
      return {
        ok: false,
        retry_after_ms: Math.max(
          0,
          boundedCommandRateLimitWindowMs - (now - session.commandRateWindowStartTs)
        )
      };
    }

    session.commandRateWindowCount += 1;
    return { ok: true, retry_after_ms: 0 };
  }

  function evaluateResumeCursor(resumePayload) {
    if (!resumePayload || typeof resumePayload !== "object") {
      return {
        status: "snapshot_required",
        reason: "CURSOR_UNKNOWN",
        cursor: null
      };
    }

    const rawCursor = resumePayload.last_seq;
    if (!Number.isInteger(rawCursor) || rawCursor < 0) {
      return {
        status: "snapshot_required",
        reason: "CURSOR_UNKNOWN",
        cursor: null
      };
    }

    const cursor = rawCursor;
    const oldest = eventTimeline.oldestSeq();
    const latest = eventTimeline.latestSeq();

    if (latest === 0) {
      return {
        status: "snapshot_required",
        reason: "SERVER_RESTARTED",
        cursor
      };
    }
    if (cursor > latest) {
      return {
        status: "snapshot_required",
        reason: "CURSOR_UNKNOWN",
        cursor
      };
    }
    if (cursor < Math.max(0, oldest - 1)) {
      return {
        status: "snapshot_required",
        reason: "CURSOR_STALE",
        cursor
      };
    }

    const probe = eventTimeline.replayFromCursor({
      cursor,
      limit: boundedReplayLimit
    });
    if (probe.has_more) {
      return {
        status: "snapshot_required",
        reason: "CURSOR_STALE",
        cursor
      };
    }

    return {
      status: "resumed",
      cursor,
      replay_from_seq: cursor + 1
    };
  }

  function buildErrorDashboard() {
    const alerts = [];
    const perf = getPerformanceSignals();
    if (
      thresholdSatisfied(
        commandSecurityStats.rate_limited,
        Number(effectiveAlertThresholds.rate_limited)
      )
    ) {
      alerts.push({
        key: "rate_limited",
        severity: "warning",
        value: commandSecurityStats.rate_limited,
        threshold: Number(effectiveAlertThresholds.rate_limited),
        message: "Command throttling is elevated."
      });
    }
    if (
      thresholdSatisfied(
        commandSecurityStats.validation_failed,
        Number(effectiveAlertThresholds.validation_failed)
      )
    ) {
      alerts.push({
        key: "validation_failed",
        severity: "warning",
        value: commandSecurityStats.validation_failed,
        threshold: Number(effectiveAlertThresholds.validation_failed),
        message: "Command validation failures are elevated."
      });
    }
    if (
      thresholdSatisfied(
        observability.sessions.socket_errors,
        Number(effectiveAlertThresholds.socket_errors)
      )
    ) {
      alerts.push({
        key: "socket_errors",
        severity: "warning",
        value: observability.sessions.socket_errors,
        threshold: Number(effectiveAlertThresholds.socket_errors),
        message: "Socket errors exceeded alert threshold."
      });
    }
    if (
      thresholdSatisfied(
        observability.command.blocked_by_restoration,
        Number(effectiveAlertThresholds.restoration_blocked)
      )
    ) {
      alerts.push({
        key: "restoration_blocked",
        severity: "critical",
        value: observability.command.blocked_by_restoration,
        threshold: Number(effectiveAlertThresholds.restoration_blocked),
        message: "Command processing repeatedly blocked by restoration consistency gate."
      });
    }
    if (restoration.getStats().consistency_ok === false) {
      alerts.push({
        key: "restoration_inconsistent",
        severity: "critical",
        value: 1,
        threshold: 1,
        message: "Server restoration consistency checks failed; command processing blocked."
      });
    }
    if (
      thresholdSatisfied(
        perf.tickDurationMs,
        Number(effectiveAlertThresholds.slow_tick_ms)
      )
    ) {
      alerts.push({
        key: "slow_tick_ms",
        severity: "warning",
        value: perf.tickDurationMs,
        threshold: Number(effectiveAlertThresholds.slow_tick_ms),
        message: "Simulation tick duration is elevated."
      });
    }
    if (
      thresholdSatisfied(
        perf.queueLatencyP95,
        Number(effectiveAlertThresholds.queue_latency_ms)
      )
    ) {
      alerts.push({
        key: "queue_latency_ms",
        severity: "warning",
        value: perf.queueLatencyP95,
        threshold: Number(effectiveAlertThresholds.queue_latency_ms),
        message: "Simulation queue latency is elevated."
      });
    }

    return {
      status: alerts.some((alert) => alert.severity === "critical")
        ? "critical"
        : alerts.length > 0
          ? "warning"
          : "healthy",
      alerts,
      last_error: observability.last_error
    };
  }

  function getObservabilityStats() {
    return {
      ...observability,
      recent_errors: [...recentErrors],
      retention: {
        max_entries: boundedDiagnosticsRetentionMaxEntries,
        max_age_ms: boundedDiagnosticsRetentionMaxAgeMs
      },
      alert_thresholds: effectiveAlertThresholds
    };
  }

  function exportDiagnostics({
    includeSensitive = false,
    eventLimit = 2000,
    lifecycleLimit = boundedDiagnosticsRetentionMaxEntries
  } = {}) {
    const boundedEventLimit = Number.isFinite(eventLimit) ? Math.max(1, Math.floor(eventLimit)) : 2000;
    const boundedLifecycleLimit = Number.isFinite(lifecycleLimit)
      ? Math.max(1, Math.floor(lifecycleLimit))
      : boundedDiagnosticsRetentionMaxEntries;

    const events = eventTimeline.readSince(0, {
      limit: boundedEventLimit
    });

    return createSafeExportBundle(
      {
        lifecycleLog,
        observability: getObservabilityStats(),
        eventTimeline: events
      },
      {
        includeSensitive,
        maxLifecycleEntries: boundedLifecycleLimit,
        maxEventEntries: boundedEventLimit,
        now: nowTs
      }
    );
  }

  function thresholdSatisfied(value, threshold) {
    return Number.isFinite(threshold) && threshold > 0 && value >= threshold;
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          simulation: simulation.getStats(),
          snapshot_publisher: {
            rate_hz: configuredSnapshotRateHz,
            interval_ms: snapshotIntervalMs,
            published_count: snapshotPublishCount,
            last_published_ts: lastSnapshotPublishedTs
          },
          replay_resync: {
            ...replayResyncStats,
            replay_limit: boundedReplayLimit,
            buffer_size: eventBufferSize
          },
          command_security: {
            ...commandSecurityStats,
            rate_limit: {
              max_commands: boundedCommandRateLimitMax,
              window_ms: boundedCommandRateLimitWindowMs
            }
          },
          privacy_controls: {
            diagnostics_retention: {
              max_entries: boundedDiagnosticsRetentionMaxEntries,
              max_age_ms: boundedDiagnosticsRetentionMaxAgeMs
            },
            export_default_redacted: true
          },
          observability: getObservabilityStats(),
          error_dashboard: buildErrorDashboard(),
          state_restoration: restoration.getStats(),
          tick_rate_bounds_hz: {
            min: MIN_TICK_RATE_HZ,
            max: MAX_TICK_RATE_HZ
          },
          snapshot_rate_bounds_hz: {
            min: MIN_SNAPSHOT_RATE_HZ,
            max: MAX_SNAPSHOT_RATE_HZ
          }
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true });

  function logLifecycle(kind, session, extra = {}) {
    const entry = {
      kind,
      session_id: session.sessionId,
      ts: nowTs(),
      ...extra
    };
    const safeEntry = redactStructuredPayload(entry);
    lifecycleLog.push(safeEntry);
    applyDiagnosticsRetention();
    emitStructuredLog("info", safeEntry);
  }

  function onMessage(session, raw) {
    const message = parseIncoming(raw.toString());
    if (!message) {
      recordInbound("invalid_json");
      sendProtocolError(session, "msg_unknown", "VALIDATION_FAILED", "Message must be valid JSON.");
      return;
    }

    session.lastSeenTs = nowTs();
    const { type, id, payload } = message;
    recordInbound(typeof type === "string" ? type : "unknown");

    if (!session.helloReceived && type !== "hello") {
      sendProtocolError(
        session,
        id || "msg_unknown",
        "VALIDATION_FAILED",
        "hello is required before other message types."
      );
      return;
    }

    if (type === "hello") {
      if (!validateHello(payload)) {
        sendProtocolError(
          session,
          id || "msg_unknown",
          "VALIDATION_FAILED",
          "hello payload requires client.name, client.build, and client.platform."
        );
        return;
      }

      session.helloReceived = true;
      session.client = payload.client;
      session.resume = payload.resume || null;
      if (payload.resume !== undefined) {
        replayResyncStats.resume_attempts += 1;
        session.resumeDecision = evaluateResumeCursor(payload.resume);
        if (session.resumeDecision.status === "resumed") {
          replayResyncStats.resume_success += 1;
        } else {
          recordFallback(session.resumeDecision.reason || "CURSOR_UNKNOWN");
        }
      } else {
        session.resumeDecision = {
          status: "snapshot_required",
          reason: "CURSOR_UNKNOWN",
          cursor: null
        };
      }
      sendEnvelope(session, "hello_ack", {
        session_id: session.sessionId,
        protocol_v: protocolVersion,
        resume: {
          status: session.resumeDecision.status,
          reason: session.resumeDecision.reason || null,
          replay_from_seq: session.resumeDecision.replay_from_seq || null
        }
      });
      return;
    }

    if (type === "subscribe") {
      if (!validateSubscribe(payload)) {
        sendProtocolError(
          session,
          id || "msg_unknown",
          "VALIDATION_FAILED",
          "subscribe payload requires scene_id and channels."
        );
        return;
      }

      session.subscribed = true;
      session.sceneId = payload.scene_id;
      session.channels = payload.channels;

      simulation.setSceneId(payload.scene_id);
      const snapshotPayload = buildPublishedSnapshot(payload.scene_id);
      sendEnvelope(session, "snapshot", snapshotPayload);

      if (session.resumeDecision?.status === "resumed" && session.channels?.events) {
        const replayPage = eventTimeline.replayFromCursor({
          cursor: session.resumeDecision.cursor || 0,
          limit: boundedReplayLimit
        });
        if (!replayPage.has_more) {
          replayResyncStats.replayed_events += replayPage.events.length;
          deliverEventsToSession(session, replayPage.events);
        } else {
          recordFallback("CURSOR_STALE");
        }
      } else {
        const replayEvents = eventTimeline.readSince(session.lastEventSeq || 0);
        deliverEventsToSession(session, replayEvents);
      }
      return;
    }

    if (type === "ping") {
      sendEnvelope(session, "pong", { nonce: payload?.nonce || null });
      return;
    }

    if (type === "command") {
      observability.command.attempted += 1;
      const quota = consumeCommandQuota(session);
      if (!quota.ok) {
        observability.command.rate_limited += 1;
        commandSecurityStats.rate_limited += 1;
        sendProtocolError(
          session,
          id || "msg_unknown",
          "RATE_LIMITED",
          `Too many commands; retry in ${quota.retry_after_ms}ms.`
        );
        return;
      }
      if (!restoration.canAcceptCommands()) {
        observability.command.blocked_by_restoration += 1;
        maybeEmitThresholdAlert({
          key: "restoration_blocked",
          value: observability.command.blocked_by_restoration,
          threshold: Number(effectiveAlertThresholds.restoration_blocked),
          severity: "critical",
          message: "Command traffic blocked by restoration consistency gate."
        });
        sendProtocolError(
          session,
          id || "msg_unknown",
          "NOT_ALLOWED",
          "Command processing is blocked until state restoration consistency checks pass."
        );
        return;
      }
      const result = commandRouter.handle(payload);
      if (result.ok) {
        observability.command.ok += 1;
        sendEnvelope(session, "ack", { in_reply_to: id || "msg_unknown", status: "ok" });
        if (Number.isInteger(result.sanitized_text_fields) && result.sanitized_text_fields > 0) {
          commandSecurityStats.sanitized_text_fields += result.sanitized_text_fields;
        }
        emitStructuredLog("info", {
          kind: "command_ok",
          session_id: session.sessionId,
          command_id: id || "msg_unknown",
          command_name: payload?.name || "unknown"
        });
        const commandPayload = result.sanitized_payload || payload;
        restoration.persistCommand(commandPayload, {
          in_reply_to: id || "msg_unknown",
          session_id: session.sessionId
        });
        emitCommandEvents(commandPayload, id || "msg_unknown");
      } else {
        observability.command.failed += 1;
        if (result?.code === "VALIDATION_FAILED") {
          commandSecurityStats.validation_failed += 1;
          maybeEmitThresholdAlert({
            key: "validation_failed",
            value: commandSecurityStats.validation_failed,
            threshold: Number(effectiveAlertThresholds.validation_failed),
            message: "Command validation failures exceeded threshold."
          });
        }
        sendProtocolError(
          session,
          id || "msg_unknown",
          result?.code || "INTERNAL",
          result?.message || "Command failed."
        );
      }
      maybeEmitPerformanceAlerts();
      return;
    }

    sendProtocolError(
      session,
      id || "msg_unknown",
      "NOT_ALLOWED",
      `Unsupported message type: ${type}`
    );
  }

  wss.on("connection", (ws, req) => {
    observability.sessions.connected += 1;
    const sessionId = messageId("sess");
    const session = {
      sessionId,
      ws,
      protocolVersion,
      connectedTs: nowTs(),
      lastSeenTs: nowTs(),
      disconnectedTs: null,
      helloReceived: false,
      subscribed: false,
      sceneId: null,
      channels: null,
      client: null,
      resume: null,
      resumeDecision: {
        status: "snapshot_required",
        reason: "CURSOR_UNKNOWN",
        cursor: null
      },
      lastEventSeq: 0,
      commandRateWindowStartTs: 0,
      commandRateWindowCount: 0,
      recordOutbound,
      recordServerError: ({ code, message, in_reply_to }) =>
        recordServerError({
          code,
          message,
          in_reply_to,
          session_id: sessionId
        }),
      remoteAddress: req.socket.remoteAddress || "unknown"
    };
    sessions.set(sessionId, session);
    logLifecycle("connected", session, { remote_address: session.remoteAddress });

    ws.on("message", (raw) => onMessage(session, raw));
    ws.on("error", (error) => {
      observability.sessions.socket_errors += 1;
      maybeEmitThresholdAlert({
        key: "socket_errors",
        value: observability.sessions.socket_errors,
        threshold: Number(effectiveAlertThresholds.socket_errors),
        message: "Socket errors exceeded threshold."
      });
      logLifecycle("socket_error", session, { message: String(error?.message || error) });
    });
    ws.on("close", (code, reasonBuffer) => {
      observability.sessions.disconnected += 1;
      session.disconnectedTs = nowTs();
      const reason = reasonBuffer?.toString() || "";
      logLifecycle("disconnected", session, { code, reason });
    });
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws/world") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  return {
    async start() {
      restoration.bootstrap();
      await new Promise((resolve) => server.listen(port, host, resolve));
      simulation.start();
      snapshotTimer = setInterval(publishSnapshotsToSubscribers, snapshotIntervalMs);
      snapshotTimer.unref?.();
      const address = server.address();
      const listeningPort =
        typeof address === "object" && address ? address.port : port;
      return {
        host,
        port: listeningPort,
        simulation: simulation.getStats(),
        state_restoration: restoration.getStats()
      };
    },

    async stop() {
      clearInterval(snapshotTimer);
      snapshotTimer = null;
      simulation.stop();
      for (const session of sessions.values()) {
        if (session.ws.readyState === session.ws.OPEN) {
          session.ws.close(1000, "server_shutdown");
        }
      }
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },

    tickSimulation(times = 1) {
      return simulation.tick(times);
    },

    getSimulationStats() {
      return simulation.getStats();
    },

    getSnapshot(sceneIdOverride) {
      return buildPublishedSnapshot(sceneIdOverride);
    },

    getSnapshotPublisherStats() {
      return {
        rate_hz: configuredSnapshotRateHz,
        interval_ms: snapshotIntervalMs,
        published_count: snapshotPublishCount,
        last_published_ts: lastSnapshotPublishedTs
      };
    },

    getEventTimeline({ sinceSeq = 0, limit = null, inclusive = false } = {}) {
      return eventTimeline.readSince(sinceSeq, { limit, inclusive });
    },

    getEventReplayPage({ cursor = 0, limit = 100, inclusive = false } = {}) {
      return eventTimeline.replayFromCursor({
        cursor,
        limit,
        inclusive
      });
    },

    getEventTimelineStats() {
      return {
        oldest_seq: eventTimeline.oldestSeq(),
        latest_seq: eventTimeline.latestSeq(),
        size: eventTimeline.size(),
        persist_path: eventTimeline.persistPath()
      };
    },

    getReplayResyncStats() {
      return {
        ...replayResyncStats,
        replay_limit: boundedReplayLimit,
        buffer_size: eventBufferSize
      };
    },

    getCommandSecurityStats() {
      return {
        ...commandSecurityStats,
        rate_limit: {
          max_commands: boundedCommandRateLimitMax,
          window_ms: boundedCommandRateLimitWindowMs
        }
      };
    },

    getObservabilityStats,

    getErrorDashboard: buildErrorDashboard,

    exportDiagnostics,

    getStateRestorationStats() {
      return restoration.getStats();
    },

    getLifecycleLog() {
      return [...lifecycleLog];
    },

    getSessions() {
      return Array.from(sessions.values()).map((session) => ({
        session_id: session.sessionId,
        connected_ts: session.connectedTs,
        disconnected_ts: session.disconnectedTs,
        remote_address: session.remoteAddress,
        hello_received: session.helloReceived,
        subscribed: session.subscribed,
        scene_id: session.sceneId,
        channels: session.channels
      }));
    },

    publishAgentStream(rawPayload) {
      const normalized = normalizeAgentStreamPayload(rawPayload);
      if (!normalized.ok) {
        return normalized;
      }

      const payload = normalized.payload;
      streamSeqById.set(payload.stream_id, payload.seq);
      if (payload.done) {
        streamSeqById.delete(payload.stream_id);
        completedStreamIds.add(payload.stream_id);
      }

      broadcastAgentStream(payload);
      publishTaskProgressPreview(payload);
      return {
        ok: true,
        payload
      };
    }
  };
}
