#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");

const GOLDEN_COMMANDS = [
  "submit_request",
  "assign_task",
  "auto_assign",
  "resolve_decision",
  "approve_artifact",
  "request_changes",
  "split_into_tasks"
];

const MICROCOPY_FUNCTIONS = [
  "inboxErrorMicrocopy",
  "taskBoardErrorMicrocopy",
  "decisionErrorMicrocopy",
  "artifactErrorMicrocopy"
];

const ACTION_WORD_RE = /\b(retry|reconnect|refresh|wait|select|enter|provide|verify)\b/i;
const DEAD_END_PHRASES = [
  /\b(connection unavailable)\b/i,
  /\b(cannot proceed)\b/i,
  /\b(dead[\s-]?end)\b/i,
  /\b(unsupported offline)\b/i
];

const FILES = {
  commandGateway: "apps/client-web/src/network/commandGateway.ts",
  worldSocketGateway: "apps/client-web/src/network/worldSocketGateway.ts",
  offlineRuntime: "apps/client-web/src/offline/mockWorldRuntime.ts",
  dispatchModules: [
    "apps/client-web/src/network/inboxCommands.ts",
    "apps/client-web/src/network/taskBoardCommands.ts",
    "apps/client-web/src/network/decisionCommands.ts",
    "apps/client-web/src/network/artifactCommands.ts"
  ]
};

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relativePath), "utf8");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function collectMatches(source, regex, group = 1) {
  const values = [];
  for (const match of source.matchAll(regex)) {
    if (typeof match[group] === "string") {
      values.push(match[group]);
    }
  }
  return values;
}

function missingFrom(required, actual) {
  const set = new Set(actual);
  return required.filter((item) => !set.has(item));
}

function extractFunctionBody(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) {
    return null;
  }

  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) {
    return null;
  }

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const token = source[index];
    if (token === "{") {
      depth += 1;
    } else if (token === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }
  return null;
}

function evaluateMicrocopyChecks(modulePath, source, failures) {
  const returnMessages = [];
  for (const functionName of MICROCOPY_FUNCTIONS) {
    const body = extractFunctionBody(source, functionName);
    if (!body) {
      continue;
    }

    const returns = collectMatches(body, /return\s+"([^"]+)"/g);
    for (const message of returns) {
      returnMessages.push({ functionName, message });
      if (!message.includes("Next:")) {
        failures.push(
          `${modulePath}:${functionName} return missing "Next:" guidance -> "${message}"`
        );
      }
    }
  }

  const localErrors = collectMatches(source, /set[A-Za-z]+Error\("([^"]+)"\)/g);
  for (const message of localErrors) {
    if (!ACTION_WORD_RE.test(message)) {
      failures.push(`${modulePath}: local error lacks actionable guidance -> "${message}"`);
    }
  }

  const allMessages = [...returnMessages.map((item) => item.message), ...localErrors];
  for (const phrase of DEAD_END_PHRASES) {
    for (const message of allMessages) {
      if (phrase.test(message) && !ACTION_WORD_RE.test(message)) {
        failures.push(`${modulePath}: dead-end phrasing without recovery action -> "${message}"`);
      }
    }
  }
}

function main() {
  const failures = [];
  const microcopyFailures = [];
  const checks = [];

  const commandGatewaySource = readWorkspaceFile(FILES.commandGateway);
  const worldSocketGatewaySource = readWorkspaceFile(FILES.worldSocketGateway);
  const offlineRuntimeSource = readWorkspaceFile(FILES.offlineRuntime);
  const dispatchSources = FILES.dispatchModules.map((filePath) => ({
    filePath,
    source: readWorkspaceFile(filePath)
  }));

  const commandUnion = uniqueSorted(
    collectMatches(commandGatewaySource, /\|\s*"([^"]+)"/g)
  );
  const missingInUnion = missingFrom(GOLDEN_COMMANDS, commandUnion);
  if (missingInUnion.length > 0) {
    failures.push(`CommandGateway union missing golden commands: ${missingInUnion.join(", ")}`);
  }
  checks.push({
    label: "CommandGateway union covers golden commands",
    ok: missingInUnion.length === 0
  });

  const dispatchCommands = uniqueSorted(
    dispatchSources.flatMap(({ source }) => collectMatches(source, /sendCommand\("([^"]+)"/g))
  );
  const missingInDispatch = missingFrom(GOLDEN_COMMANDS, dispatchCommands);
  if (missingInDispatch.length > 0) {
    failures.push(`Dispatch modules missing golden commands: ${missingInDispatch.join(", ")}`);
  }
  checks.push({
    label: "Dispatch modules route all golden commands through CommandGateway",
    ok: missingInDispatch.length === 0
  });

  const offlineCases = uniqueSorted(collectMatches(offlineRuntimeSource, /case\s+"([^"]+)":/g));
  const missingInOffline = missingFrom(GOLDEN_COMMANDS, offlineCases);
  if (missingInOffline.length > 0) {
    failures.push(`Offline runtime switch missing golden commands: ${missingInOffline.join(", ")}`);
  }
  checks.push({
    label: "Offline runtime handles all golden commands",
    ok: missingInOffline.length === 0
  });

  const liveGatewayUsesSharedContract =
    /createWorldSocketGateway/.test(worldSocketGatewaySource) &&
    /sendCommand<K extends CommandName>/.test(worldSocketGatewaySource) &&
    /commandName:\s*name/.test(worldSocketGatewaySource);
  if (!liveGatewayUsesSharedContract) {
    failures.push("WorldSocketGateway no longer maps sendCommand to shared CommandGateway semantics.");
  }
  checks.push({
    label: "Live gateway keeps shared CommandGateway semantics",
    ok: liveGatewayUsesSharedContract
  });

  for (const { filePath, source } of dispatchSources) {
    evaluateMicrocopyChecks(filePath, source, microcopyFailures);
  }
  failures.push(...microcopyFailures);
  checks.push({
    label: "Regression guard: no dead-end offline microcopy in dispatch modules",
    ok: microcopyFailures.length === 0
  });

  console.log("[parity] Offline-live parity regression checks");
  for (const check of checks) {
    console.log(`[parity] ${check.ok ? "PASS" : "FAIL"} ${check.label}`);
  }

  if (failures.length > 0) {
    console.error("");
    console.error("[parity] Failures:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log(
    `[parity] PASS: ${GOLDEN_COMMANDS.length} golden commands validated across command union, dispatch modules, and offline runtime.`
  );
}

main();
