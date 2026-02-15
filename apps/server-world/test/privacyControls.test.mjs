import assert from "node:assert/strict";
import {
  createSafeExportBundle,
  pruneEntries,
  redactStructuredPayload
} from "../src/privacyControls.mjs";

function testRedactionNestedKeys() {
  const redacted = redactStructuredPayload({
    level: "info",
    payload: {
      text: "secret request text",
      nested: {
        authorization: "Bearer abc",
        keep: "visible"
      }
    }
  });

  assert.equal(redacted.payload.text, "[REDACTED]");
  assert.equal(redacted.payload.nested.authorization, "[REDACTED]");
  assert.equal(redacted.payload.nested.keep, "visible");
}

function testRetentionPruningDeterministic() {
  const nowValue = 5000;
  const entries = [
    { ts: 1000, value: "old" },
    { ts: 3000, value: "mid" },
    { ts: 4500, value: "new" }
  ];

  const retained = pruneEntries(entries, {
    maxEntries: 2,
    maxAgeMs: 2500,
    now: () => nowValue
  });

  assert.deepEqual(
    retained.map((item) => item.value),
    ["mid", "new"]
  );
}

function testSafeExportDefaultsToRedacted() {
  const bundle = createSafeExportBundle(
    {
      lifecycleLog: [{ ts: 1, message: "ok", text: "private" }],
      observability: {
        last_error: { ts: 2, message: "boom", token: "secret-token" }
      },
      eventTimeline: [{ seq: 1, payload: { instructions: "do thing" } }]
    },
    {
      now: () => 42
    }
  );

  assert.equal(bundle.include_sensitive, false);
  assert.equal(bundle.exported_at_ts, 42);
  assert.equal(bundle.lifecycle_log[0].text, "[REDACTED]");
  assert.equal(bundle.observability.last_error.token, "[REDACTED]");
  assert.equal(bundle.event_timeline[0].payload.instructions, "[REDACTED]");
}

function run() {
  testRedactionNestedKeys();
  testRetentionPruningDeterministic();
  testSafeExportDefaultsToRedacted();
  console.log("server-world privacy controls tests passed.");
}

run();
