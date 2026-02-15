import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEventTimeline } from "../src/eventTimeline.mjs";

function testMonotonicAppendAndRead() {
  const timeline = createEventTimeline({ initialSeq: 10, maxEvents: 100 });
  const first = timeline.append({ name: "task_started", project_id: "proj_abc" });
  const second = timeline.append({ name: "task_done", project_id: "proj_abc" });

  assert.equal(first.seq, 11);
  assert.equal(second.seq, 12);

  const all = timeline.readSince(0);
  assert.equal(all.length, 2);
  assert.equal(all[0].seq, 11);
  assert.equal(all[1].seq, 12);
  assert.equal(timeline.latestSeq(), 12);
}

function testBoundedBuffer() {
  const timeline = createEventTimeline({ initialSeq: 0, maxEvents: 10 });
  for (let index = 0; index < 18; index += 1) {
    timeline.append({
      name: "task_progress",
      project_id: "proj_abc",
      meta: { idx: index }
    });
  }

  assert.equal(timeline.size(), 10);
  const current = timeline.readSince(0);
  assert.equal(current[0].seq, 9);
  assert.equal(current[current.length - 1].seq, 18);
}

function testCursorReplayPagination() {
  const timeline = createEventTimeline({ initialSeq: 0, maxEvents: 100 });
  for (let index = 0; index < 5; index += 1) {
    timeline.append({ name: "task_progress", project_id: "proj_abc", meta: { idx: index } });
  }

  const firstPage = timeline.replayFromCursor({ cursor: 0, limit: 2 });
  assert.equal(firstPage.events.length, 2);
  assert.equal(firstPage.events[0].seq, 1);
  assert.equal(firstPage.events[1].seq, 2);
  assert.equal(firstPage.has_more, true);
  assert.equal(firstPage.next_cursor, 2);

  const secondPage = timeline.replayFromCursor({ cursor: firstPage.next_cursor, limit: 2 });
  assert.equal(secondPage.events.length, 2);
  assert.equal(secondPage.events[0].seq, 3);
  assert.equal(secondPage.events[1].seq, 4);
  assert.equal(secondPage.has_more, true);
  assert.equal(secondPage.next_cursor, 4);

  const lastPage = timeline.replayFromCursor({ cursor: secondPage.next_cursor, limit: 2 });
  assert.equal(lastPage.events.length, 1);
  assert.equal(lastPage.events[0].seq, 5);
  assert.equal(lastPage.has_more, false);
  assert.equal(lastPage.next_cursor, 5);
}

function testDurablePersistenceReload() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "officeclaw-event-log-"));
  const persistPath = path.join(tempDir, "events.jsonl");

  const first = createEventTimeline({ initialSeq: 0, persistPath, maxEvents: 100 });
  first.append({ name: "task_assigned", project_id: "proj_abc", task_id: "task_copy" });
  first.append({ name: "task_started", project_id: "proj_abc", task_id: "task_copy" });
  assert.equal(first.latestSeq(), 2);

  const second = createEventTimeline({ initialSeq: 0, persistPath, maxEvents: 100 });
  const persisted = second.readSince(0);
  assert.equal(persisted.length, 2);
  assert.equal(persisted[0].seq, 1);
  assert.equal(persisted[1].seq, 2);

  second.append({ name: "task_done", project_id: "proj_abc", task_id: "task_copy" });
  assert.equal(second.latestSeq(), 3);
  const replay = second.replayFromCursor({ cursor: 1, limit: 5 });
  assert.deepEqual(
    replay.events.map((event) => event.seq),
    [2, 3]
  );
}

function run() {
  testMonotonicAppendAndRead();
  testBoundedBuffer();
  testCursorReplayPagination();
  testDurablePersistenceReload();
  console.log("server-world event timeline tests passed.");
}

run();
