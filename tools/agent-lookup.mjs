#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const MAP_PATH = path.resolve("docs/agent-lookup-map.json");

function usage() {
  return [
    "Usage: node tools/agent-lookup.mjs [options]",
    "",
    "Options:",
    "  --list                  List all topic ids with titles",
    "  --topic <id>            Show one topic by id",
    "  --search <text>         Search topics by id/title/tags/when_to_use",
    "  --json                  Output machine-readable JSON",
    "  -h, --help              Show help",
    "",
    "Examples:",
    "  node tools/agent-lookup.mjs --list",
    "  node tools/agent-lookup.mjs --topic contracts-validation",
    "  node tools/agent-lookup.mjs --search offline"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    list: false,
    topic: "",
    search: "",
    json: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--list") {
      args.list = true;
      continue;
    }
    if (token === "--topic" && next) {
      args.topic = next;
      i += 1;
      continue;
    }
    if (token === "--search" && next) {
      args.search = next;
      i += 1;
      continue;
    }
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function loadMap() {
  if (!fs.existsSync(MAP_PATH)) {
    throw new Error(`Lookup map not found: ${MAP_PATH}`);
  }
  return JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function toSearchText(topic) {
  return normalize(
    [
      topic.id,
      topic.title,
      ...(topic.tags || []),
      ...(topic.when_to_use || []),
      ...(topic.first_files || []),
      ...(topic.related_docs || [])
    ].join(" ")
  );
}

function printTopic(topic) {
  const lines = [];
  lines.push(`${topic.id}: ${topic.title}`);
  lines.push("");

  if (Array.isArray(topic.tags) && topic.tags.length > 0) {
    lines.push(`tags: ${topic.tags.join(", ")}`);
    lines.push("");
  }

  if (Array.isArray(topic.when_to_use) && topic.when_to_use.length > 0) {
    lines.push("when to use:");
    for (const item of topic.when_to_use) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (Array.isArray(topic.first_files) && topic.first_files.length > 0) {
    lines.push("start with files:");
    for (const item of topic.first_files) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (Array.isArray(topic.commands) && topic.commands.length > 0) {
    lines.push("commands:");
    for (const item of topic.commands) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (Array.isArray(topic.related_docs) && topic.related_docs.length > 0) {
    lines.push("related docs:");
    for (const item of topic.related_docs) {
      lines.push(`- ${item}`);
    }
  }

  console.log(lines.join("\n").trimEnd());
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(`\n${usage()}`);
    process.exit(2);
  }

  if (args.help) {
    console.log(usage());
    return;
  }

  const map = loadMap();
  const topics = Array.isArray(map.topics) ? map.topics : [];

  if (args.list || (!args.topic && !args.search)) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            project: map.project,
            updated_at: map.updated_at,
            topics: topics.map((topic) => ({ id: topic.id, title: topic.title }))
          },
          null,
          2
        )
      );
      return;
    }

    console.log(`agent lookup topics (${topics.length})`);
    for (const topic of topics) {
      console.log(`- ${topic.id}: ${topic.title}`);
    }
    return;
  }

  if (args.topic) {
    const found = topics.find((topic) => topic.id === args.topic);
    if (!found) {
      console.error(`Unknown topic id: ${args.topic}`);
      process.exit(1);
    }

    if (args.json) {
      console.log(JSON.stringify(found, null, 2));
      return;
    }
    printTopic(found);
    return;
  }

  const query = normalize(args.search);
  const matches = topics.filter((topic) => toSearchText(topic).includes(query));

  if (args.json) {
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  if (matches.length === 0) {
    console.log(`No topics matched '${args.search}'.`);
    return;
  }

  console.log(`Matched ${matches.length} topic(s) for '${args.search}':\n`);
  for (const topic of matches) {
    printTopic(topic);
    console.log("");
  }
}

main();
