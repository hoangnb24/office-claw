#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const USAGE = `Usage:
  node tools/session-trace.mjs export --events <events.jsonl> --commands <commands.jsonl> --out <trace.json> [--max-events N] [--max-commands N] [--include-sensitive]
  node tools/session-trace.mjs import --in <trace.json> --events-out <events.jsonl> --commands-out <commands.jsonl> [--allow-overwrite] [--allow-sensitive]

Guardrail:
  Requires either OFFICECLAW_NON_PROD=1 or --non-prod-ok.
`;

const SENSITIVE_KEYS = new Set([
  "text",
  "instructions",
  "prompt",
  "choice",
  "token",
  "secret",
  "authorization",
  "session_key",
  "content",
  "body"
]);

function fail(message) {
  console.error(`session-trace: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [action, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { action, flags };
}

function ensureNonProd(flags) {
  if (process.env.OFFICECLAW_NON_PROD === "1" || flags["non-prod-ok"] === true) {
    return;
  }
  fail("non-production guard failed. Set OFFICECLAW_NON_PROD=1 or pass --non-prod-ok.");
}

function ensureParentDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function readJsonl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    return [];
  }
  const rows = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Ignore malformed lines to keep utility resilient for operator use.
    }
  }
  return rows;
}

function writeJsonl(filePath, rows, allowOverwrite) {
  if (!allowOverwrite && fs.existsSync(filePath)) {
    fail(`output exists: ${filePath} (pass --allow-overwrite to replace).`);
  }
  ensureParentDir(filePath);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, body ? `${body}\n` : "");
}

function redactAny(value, key = null) {
  if (Array.isArray(value)) {
    return value.map((item) => redactAny(item, key));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = redactAny(childValue, childKey);
    }
    return out;
  }
  if (typeof key === "string" && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  return value;
}

function parseLimit(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`invalid limit value: ${value}`);
  }
  return Math.floor(parsed);
}

function sortedEvents(events) {
  return [...events].sort((a, b) => {
    const left = Number.isFinite(a?.seq) ? a.seq : 0;
    const right = Number.isFinite(b?.seq) ? b.seq : 0;
    return left - right;
  });
}

function sortedCommands(commands) {
  return [...commands].sort((a, b) => {
    const left = Number.isFinite(a?.journal_seq) ? a.journal_seq : 0;
    const right = Number.isFinite(b?.journal_seq) ? b.journal_seq : 0;
    return left - right;
  });
}

function exportTrace(flags) {
  const eventsPath = typeof flags.events === "string" ? flags.events : null;
  const commandsPath = typeof flags.commands === "string" ? flags.commands : null;
  const outPath = typeof flags.out === "string" ? flags.out : null;
  if (!eventsPath || !commandsPath || !outPath) {
    fail("export requires --events, --commands, and --out.");
  }

  const maxEvents = parseLimit(flags["max-events"], 5000);
  const maxCommands = parseLimit(flags["max-commands"], 5000);
  const includeSensitive = flags["include-sensitive"] === true;

  const events = sortedEvents(readJsonl(eventsPath)).slice(-maxEvents);
  const commands = sortedCommands(readJsonl(commandsPath)).slice(-maxCommands);

  const payload = {
    schema_version: 1,
    exported_at_ts: Date.now(),
    include_sensitive: includeSensitive,
    max_events: maxEvents,
    max_commands: maxCommands,
    sources: {
      events_path: eventsPath,
      commands_path: commandsPath
    },
    events: includeSensitive ? events : redactAny(events),
    commands: includeSensitive ? commands : redactAny(commands)
  };

  ensureParentDir(outPath);
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify({
      ok: true,
      action: "export",
      out_path: outPath,
      event_count: events.length,
      command_count: commands.length,
      include_sensitive: includeSensitive
    })
  );
}

function importTrace(flags) {
  const inPath = typeof flags.in === "string" ? flags.in : null;
  const eventsOutPath = typeof flags["events-out"] === "string" ? flags["events-out"] : null;
  const commandsOutPath = typeof flags["commands-out"] === "string" ? flags["commands-out"] : null;
  if (!inPath || !eventsOutPath || !commandsOutPath) {
    fail("import requires --in, --events-out, and --commands-out.");
  }
  if (!fs.existsSync(inPath)) {
    fail(`trace file not found: ${inPath}`);
  }

  const allowOverwrite = flags["allow-overwrite"] === true;
  const allowSensitive = flags["allow-sensitive"] === true;
  const trace = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (!trace || typeof trace !== "object") {
    fail("trace payload must be an object.");
  }
  if (!Array.isArray(trace.events) || !Array.isArray(trace.commands)) {
    fail("trace payload missing events/commands arrays.");
  }
  if (trace.include_sensitive === true && !allowSensitive) {
    fail("trace is sensitive. pass --allow-sensitive to import.");
  }

  writeJsonl(eventsOutPath, trace.events, allowOverwrite);
  writeJsonl(commandsOutPath, trace.commands, allowOverwrite);

  console.log(
    JSON.stringify({
      ok: true,
      action: "import",
      events_out: eventsOutPath,
      commands_out: commandsOutPath,
      event_count: trace.events.length,
      command_count: trace.commands.length,
      include_sensitive: trace.include_sensitive === true
    })
  );
}

function main() {
  const { action, flags } = parseArgs(process.argv.slice(2));
  if (!action || !["export", "import"].includes(action)) {
    console.error(USAGE);
    process.exit(action ? 1 : 0);
  }

  ensureNonProd(flags);

  if (action === "export") {
    exportTrace(flags);
    return;
  }
  importTrace(flags);
}

main();
