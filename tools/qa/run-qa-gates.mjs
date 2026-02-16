#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const VALID_GROUPS = new Set(["all", "client", "contracts", "preflight", "parity"]);

const CHECKS = [
  {
    id: "client:typecheck",
    group: "client",
    cmd: ["npm", "--prefix", "apps/client-web", "run", "typecheck"]
  },
  {
    id: "client:build",
    group: "client",
    cmd: ["npm", "--prefix", "apps/client-web", "run", "build"]
  },
  {
    id: "contracts:validate",
    group: "contracts",
    cmd: ["npm", "--prefix", "contracts", "run", "validate"]
  },
  {
    id: "contracts:session-key",
    group: "contracts",
    cmd: ["npm", "--prefix", "contracts", "run", "validate:session-key"]
  },
  {
    id: "assets:verify",
    group: "preflight",
    cmd: ["npm", "--prefix", "apps/client-web", "run", "assets:verify"]
  },
  {
    id: "provenance:gate",
    group: "preflight",
    cmd: [
      "node",
      "tools/asset-provenance-ledger.mjs",
      "--strict",
      "--require-manifests",
      "--out",
      "reports/asset-provenance-ledger.md"
    ]
  },
  {
    id: "parity:offline-live",
    group: "parity",
    cmd: ["node", "tools/qa/check-offline-live-parity.mjs"]
  },
  {
    id: "glb:preflight",
    group: "preflight",
    cmd: [
      "node",
      "tools/glb-preflight.mjs",
      "--scene",
      "assets/scenes/cozy_office_v0.scene.json",
      "--asset-root",
      "assets/glb",
      "--report",
      "reports/glb-preflight-report.latest.md"
    ]
  }
];

function usage() {
  return [
    "Usage: node tools/qa/run-qa-gates.mjs [--only <group[,group...]>] [--dry-run]",
    "",
    "Groups:",
    "  all        Run full gate suite (default)",
    "  client     Run client typecheck/build",
    "  contracts  Run contracts validation checks",
    "  preflight  Run runtime asset and GLB preflight checks",
    "  parity     Run offline-live gateway parity regression checks",
    "",
    "Examples:",
    "  node tools/qa/run-qa-gates.mjs",
    "  node tools/qa/run-qa-gates.mjs --only contracts",
    "  node tools/qa/run-qa-gates.mjs --only client,contracts --dry-run"
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    groups: ["all"],
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--only" && next) {
      const parsed = next
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (parsed.length === 0) {
        throw new Error("Expected at least one group after --only");
      }
      for (const group of parsed) {
        if (!VALID_GROUPS.has(group)) {
          throw new Error(`Unknown group '${group}'`);
        }
      }
      options.groups = parsed;
      i += 1;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function shouldRunCheck(groups, checkGroup) {
  if (groups.includes("all")) {
    return true;
  }
  return groups.includes(checkGroup);
}

function formatCommand(cmdParts) {
  return cmdParts
    .map((part) => (part.includes(" ") ? `"${part}"` : part))
    .join(" ");
}

function runCheck(check, dryRun) {
  const cmdString = formatCommand(check.cmd);
  console.log(`\n[qa] ${check.id}`);
  console.log(`[qa]   $ ${cmdString}`);

  if (dryRun) {
    return { ok: true, code: 0 };
  }

  const result = spawnSync(check.cmd[0], check.cmd.slice(1), {
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    return {
      ok: false,
      code: 1,
      error: result.error.message || String(result.error)
    };
  }

  return {
    ok: result.status === 0,
    code: result.status ?? 1
  };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(`\n${usage()}`);
    process.exit(2);
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  const selectedChecks = CHECKS.filter((check) => shouldRunCheck(options.groups, check.group));
  if (selectedChecks.length === 0) {
    console.error("No QA checks selected.");
    process.exit(2);
  }

  console.log(`[qa] Selected groups: ${options.groups.join(",")}`);
  console.log(`[qa] Mode: ${options.dryRun ? "dry-run" : "execute"}`);

  for (const check of selectedChecks) {
    const result = runCheck(check, options.dryRun);
    if (!result.ok) {
      if (result.error) {
        console.error(`[qa] FAIL ${check.id} (${result.error})`);
      } else {
        console.error(`[qa] FAIL ${check.id} (exit ${result.code})`);
      }
      process.exit(result.code || 1);
    }
    console.log(`[qa] PASS ${check.id}`);
  }

  console.log("\n[qa] All selected checks passed.");
}

main();
