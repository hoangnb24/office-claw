import fs from "node:fs";
import path from "node:path";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampLimit(limit, fallback = 100) {
  if (!Number.isFinite(limit)) {
    return fallback;
  }
  return Math.max(1, Math.floor(limit));
}

function sanitizeCursor(seq) {
  if (!Number.isFinite(seq)) {
    return 0;
  }
  return Math.max(0, Math.floor(seq));
}

function loadPersistedEvents(persistPath) {
  if (!persistPath || !fs.existsSync(persistPath)) {
    return [];
  }
  const raw = fs.readFileSync(persistPath, "utf8");
  if (!raw.trim()) {
    return [];
  }
  const loaded = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.seq === "number") {
        loaded.push(parsed);
      }
    } catch {
      // Ignore malformed persisted rows and keep loading the rest.
    }
  }
  return loaded;
}

export function createEventTimeline({
  initialSeq = 0,
  maxEvents = 2000,
  persistPath = null,
  now = Date.now
} = {}) {
  const loaded = loadPersistedEvents(persistPath);
  const events = loaded.map((item) => clone(item));
  const boundedMaxEvents = Number.isFinite(maxEvents) ? Math.max(10, Math.floor(maxEvents)) : 2000;
  const latestPersistedSeq =
    events.length > 0 ? Math.max(...events.map((event) => sanitizeCursor(event.seq))) : 0;
  let nextSeq =
    Math.max(sanitizeCursor(initialSeq), sanitizeCursor(latestPersistedSeq)) + 1;

  function trimIfNeeded() {
    if (events.length <= boundedMaxEvents) {
      return;
    }
    const removeCount = events.length - boundedMaxEvents;
    events.splice(0, removeCount);
  }

  function persistEvent(event) {
    if (!persistPath) {
      return;
    }
    const dir = path.dirname(persistPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(persistPath, `${JSON.stringify(event)}\n`);
  }

  function read({ sinceSeq = 0, inclusive = false, limit = null } = {}) {
    const cursor = sanitizeCursor(sinceSeq);
    const filtered = events.filter((event) =>
      inclusive ? sanitizeCursor(event.seq) >= cursor : sanitizeCursor(event.seq) > cursor
    );
    const appliedLimit = limit == null ? null : clampLimit(limit);
    const result = appliedLimit == null ? filtered : filtered.slice(0, appliedLimit);
    return result.map((event) => clone(event));
  }

  trimIfNeeded();

  return {
    append(payload) {
      const currentSeq = nextSeq;
      const event = {
        seq: currentSeq,
        event_id: `evt_${String(currentSeq).padStart(8, "0")}`,
        ts: now(),
        ...clone(payload)
      };
      nextSeq += 1;
      events.push(event);
      trimIfNeeded();
      persistEvent(event);
      return clone(event);
    },

    read,

    readSince(seq = 0, options = {}) {
      return read({ sinceSeq: seq, ...options });
    },

    replayFromCursor({ cursor = 0, limit = 100, inclusive = false } = {}) {
      const sanitizedCursor = sanitizeCursor(cursor);
      const safeLimit = clampLimit(limit);
      const page = read({
        sinceSeq: sanitizedCursor,
        inclusive,
        limit: safeLimit
      });
      const nextCursor =
        page.length > 0 ? sanitizeCursor(page[page.length - 1].seq) : sanitizedCursor;
      const hasMore =
        page.length === safeLimit &&
        events.some((event) => sanitizeCursor(event.seq) > nextCursor);

      return {
        events: page,
        cursor: sanitizedCursor,
        next_cursor: nextCursor,
        has_more: hasMore,
        latest_seq: this.latestSeq()
      };
    },

    latestSeq() {
      return nextSeq - 1;
    },

    oldestSeq() {
      return events.length === 0 ? 0 : sanitizeCursor(events[0].seq);
    },

    size() {
      return events.length;
    },

    persistPath() {
      return persistPath;
    }
  };
}
