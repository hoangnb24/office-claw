import { createWorldStateStore, validateSnapshotCoherence } from "./worldState.mjs";

const MIN_TICK_RATE_HZ = 10;
const MAX_TICK_RATE_HZ = 20;

function clampTickRateHz(value) {
  if (!Number.isFinite(value)) {
    return MIN_TICK_RATE_HZ;
  }
  return Math.min(MAX_TICK_RATE_HZ, Math.max(MIN_TICK_RATE_HZ, Math.round(value)));
}

function tickIntervalMs(tickRateHz) {
  return Math.floor(1000 / tickRateHz);
}

function createRollingStats() {
  return {
    samples: 0,
    total: 0,
    max: 0,
    last: 0,
    history: []
  };
}

function recordRollingSample(stats, value) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  stats.samples += 1;
  stats.total += safeValue;
  stats.last = safeValue;
  stats.max = Math.max(stats.max, safeValue);
  stats.history.push(safeValue);
  if (stats.history.length > 256) {
    stats.history.shift();
  }
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const index = Math.floor((sorted.length - 1) * clampedRatio);
  return sorted[index];
}

function serializeRollingStats(stats, precision = 2) {
  const average = stats.samples > 0 ? stats.total / stats.samples : 0;
  return {
    samples: stats.samples,
    last: Number(stats.last.toFixed(precision)),
    avg: Number(average.toFixed(precision)),
    p95: Number(percentile(stats.history, 0.95).toFixed(precision)),
    max: Number(stats.max.toFixed(precision))
  };
}

export function createSimulationRuntime({
  sceneId = "cozy_office_v0",
  tickRateHz = MIN_TICK_RATE_HZ,
  now = Date.now,
  worldStateStore
} = {}) {
  const worldState = worldStateStore || createWorldStateStore({ sceneId });
  const pendingCommands = [];
  const pendingEvents = [];

  let configuredTickRateHz = clampTickRateHz(tickRateHz);
  let intervalMs = tickIntervalMs(configuredTickRateHz);
  let timer = null;
  let running = false;
  let startedTs = null;
  let lastTickTs = null;
  let tickCount = 0;
  let seq = 0;
  let clockMs = 0;
  const tickTiming = createRollingStats();
  const commandQueueLatency = createRollingStats();
  const eventQueueLatency = createRollingStats();

  function queueLatencyMs(enqueuedTs, processedTs) {
    if (!Number.isFinite(enqueuedTs) || !Number.isFinite(processedTs)) {
      return 0;
    }
    return Math.max(0, processedTs - enqueuedTs);
  }

  function runSingleTick() {
    const tickStartedTs = now();
    tickCount += 1;
    seq += 1;
    clockMs += intervalMs;

    while (pendingCommands.length > 0) {
      const entry = pendingCommands.shift();
      const processedTs = now();
      recordRollingSample(
        commandQueueLatency,
        queueLatencyMs(entry?.enqueued_ts, processedTs)
      );
      worldState.applyCommand(entry?.payload ?? entry);
    }
    while (pendingEvents.length > 0) {
      const entry = pendingEvents.shift();
      const processedTs = now();
      recordRollingSample(
        eventQueueLatency,
        queueLatencyMs(entry?.enqueued_ts, processedTs)
      );
      worldState.applyEvent(entry?.payload ?? entry);
    }

    worldState.advanceTick({ seq, tick_count: tickCount, clock_ms: clockMs });
    lastTickTs = now();
    recordRollingSample(tickTiming, lastTickTs - tickStartedTs);
  }

  function restartTimerIfRunning() {
    if (!running) {
      return;
    }
    clearInterval(timer);
    timer = setInterval(runSingleTick, intervalMs);
    timer.unref?.();
  }

  return {
    start() {
      if (running) {
        return this.getStats();
      }
      if (startedTs === null) {
        startedTs = now();
      }
      running = true;
      timer = setInterval(runSingleTick, intervalMs);
      timer.unref?.();
      return this.getStats();
    },

    stop() {
      if (!running) {
        return this.getStats();
      }
      clearInterval(timer);
      timer = null;
      running = false;
      return this.getStats();
    },

    enqueueCommand(commandPayload) {
      pendingCommands.push({
        payload: commandPayload,
        enqueued_ts: now()
      });
    },

    enqueueEvent(eventPayload) {
      pendingEvents.push({
        payload: eventPayload,
        enqueued_ts: now()
      });
    },

    applyCommand(commandPayload) {
      return worldState.applyCommand(commandPayload);
    },

    applyEvent(eventPayload) {
      worldState.applyEvent(eventPayload);
    },

    tick(times = 1) {
      const count = Math.max(1, Number.isFinite(times) ? Math.floor(times) : 1);
      for (let index = 0; index < count; index += 1) {
        runSingleTick();
      }
      return this.getStats();
    },

    setSceneId(nextSceneId) {
      worldState.setSceneId(nextSceneId);
    },

    setTickRateHz(nextTickRateHz) {
      configuredTickRateHz = clampTickRateHz(nextTickRateHz);
      intervalMs = tickIntervalMs(configuredTickRateHz);
      restartTimerIfRunning();
      return this.getStats();
    },

    getTickRateBounds() {
      return {
        min_hz: MIN_TICK_RATE_HZ,
        max_hz: MAX_TICK_RATE_HZ
      };
    },

    getSnapshot(sceneIdOverride) {
      return {
        ...worldState.buildSnapshot(sceneIdOverride),
        seq,
        clock_ms: clockMs
      };
    },

    getStats() {
      const tickTimingStats = serializeRollingStats(tickTiming);
      const openClawRuns =
        typeof worldState.getAllOpenClawRuns === "function" ? worldState.getAllOpenClawRuns() : [];
      const openClawRunsByStatus = {};
      for (const run of openClawRuns) {
        const status = typeof run?.status === "string" ? run.status : "unknown";
        openClawRunsByStatus[status] = (openClawRunsByStatus[status] || 0) + 1;
      }
      const activeOpenClawRuns = openClawRuns.filter(
        (run) => run.status === "started" || run.status === "running"
      ).length;
      return {
        is_running: running,
        tick_rate_hz: configuredTickRateHz,
        tick_interval_ms: intervalMs,
        tick_count: tickCount,
        seq,
        clock_ms: clockMs,
        started_ts: startedTs,
        last_tick_ts: lastTickTs,
        uptime_ms: startedTs === null ? 0 : Math.max(0, now() - startedTs),
        queue_depth: {
          commands: pendingCommands.length,
          events: pendingEvents.length
        },
        tick_timing_ms: {
          ...tickTimingStats,
          last_tick_duration_ms: tickTimingStats.last
        },
        queue_latency_ms: {
          commands: serializeRollingStats(commandQueueLatency),
          events: serializeRollingStats(eventQueueLatency)
        },
        openclaw_runs: {
          total: openClawRuns.length,
          active: activeOpenClawRuns,
          by_status: openClawRunsByStatus
        }
      };
    },

    validateSnapshot() {
      return validateSnapshotCoherence(this.getSnapshot());
    }
  };
}

export { MIN_TICK_RATE_HZ, MAX_TICK_RATE_HZ };
