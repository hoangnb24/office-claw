#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REQUIRED_ASSETS = [
  {
    assetId: "office_shell",
    canonicalPath: "assets/glb/office_shell.glb",
    mirrorPath: "apps/client-web/public/assets/office_shell.glb",
    generationBead: "bd-9hcf",
    manifestCandidates: ["reports/meshy-office_shell-manifest.json"]
  },
  {
    assetId: "prop_inbox",
    canonicalPath: "assets/glb/inbox.glb",
    mirrorPath: "apps/client-web/public/assets/inbox.glb",
    generationBead: "bd-9hcf",
    manifestCandidates: ["reports/meshy-prop_inbox-manifest.json"]
  },
  {
    assetId: "prop_task_board",
    canonicalPath: "assets/glb/task_board.glb",
    mirrorPath: "apps/client-web/public/assets/task_board.glb",
    generationBead: "bd-9hcf",
    manifestCandidates: ["reports/meshy-prop_task_board-manifest.json"]
  },
  {
    assetId: "prop_delivery_shelf",
    canonicalPath: "assets/glb/shelf.glb",
    mirrorPath: "apps/client-web/public/assets/shelf.glb",
    generationBead: "bd-9hcf",
    manifestCandidates: [
      "reports/meshy-prop_delivery_shelf-manifest.json",
      "reports/meshy-shelf-manifest.json"
    ]
  },
  {
    assetId: "prop_dev_desk",
    canonicalPath: "assets/glb/desk.glb",
    mirrorPath: "apps/client-web/public/assets/desk.glb",
    generationBead: "bd-9hcf",
    manifestCandidates: [
      "reports/meshy-prop_dev_desk-manifest.json",
      "reports/meshy-desk-manifest.json"
    ]
  },
  {
    assetId: "prop_blocker_cone",
    canonicalPath: "assets/glb/blocker_cone.glb",
    mirrorPath: "apps/client-web/public/assets/blocker_cone.glb",
    generationBead: "bd-9hcf",
    manifestCandidates: [
      "reports/meshy-prop_blocker_cone-manifest.json",
      "reports/meshy-blocker_cone-manifest.json"
    ]
  },
  {
    assetId: "agent_base_skeleton",
    canonicalPath: "assets/glb/agent1_skeleton.glb",
    mirrorPath: "apps/client-web/public/assets/agent1_skeleton.glb",
    generationBead: "bd-18j1",
    manifestCandidates: [
      "reports/meshy-agent_base_skeleton-manifest.json",
      "reports/meshy-agent1-skeleton-manifest.json",
      "reports/meshy-agent1-manifest.json"
    ]
  },
  {
    assetId: "agent_animation_bundle",
    canonicalPath: "assets/glb/agent1_animations.glb",
    mirrorPath: "apps/client-web/public/assets/agent1_animations.glb",
    generationBead: "bd-18j1",
    manifestCandidates: [
      "reports/meshy-agent_animation_bundle-manifest.json",
      "reports/meshy-agent1-animations-manifest.json",
      "reports/meshy-agent1-manifest.json"
    ]
  }
];

const TRACEABILITY = Object.freeze({
  epic: "bd-zzou",
  credentialGate: "bd-dok7",
  envGeneration: "bd-9hcf",
  agentGeneration: "bd-18j1",
  ledger: "bd-2yns",
  provenanceGate: "bd-3eoj"
});

function usage() {
  return [
    "Usage: node tools/asset-provenance-ledger.mjs [options]",
    "",
    "Options:",
    "  --out <path>              Output markdown path (default: reports/asset-provenance-ledger.md)",
    "  --strict                  Exit non-zero when gate blockers are present",
    "  --require-manifests       Treat missing per-asset Meshy manifest evidence as a blocker",
    "  --tiny-threshold <bytes>  Tiny-file blocker threshold (default: 2048)",
    "  --help                    Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    out: "reports/asset-provenance-ledger.md",
    strict: false,
    requireManifests: false,
    tinyThresholdBytes: 2048
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--out" && next) {
      args.out = next;
      index += 1;
      continue;
    }
    if (token === "--strict") {
      args.strict = true;
      continue;
    }
    if (token === "--require-manifests") {
      args.requireManifests = true;
      continue;
    }
    if (token === "--tiny-threshold" && next) {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid --tiny-threshold value: ${next}`);
      }
      args.tinyThresholdBytes = parsed;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function pathExists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function collectManifestTaskIds(manifest) {
  const taskIds = new Set();
  if (!manifest || typeof manifest !== "object") {
    return [];
  }

  const tasks = manifest.tasks;
  if (!tasks || typeof tasks !== "object") {
    return [];
  }

  const pushTaskId = (value) => {
    if (typeof value === "string" && value.trim()) {
      taskIds.add(value.trim());
    }
  };

  if (tasks.generation && typeof tasks.generation === "object") {
    pushTaskId(tasks.generation.task_id);
  }
  if (tasks.rigging && typeof tasks.rigging === "object") {
    pushTaskId(tasks.rigging.task_id);
  }
  if (tasks.animations && typeof tasks.animations === "object") {
    for (const entry of Object.values(tasks.animations)) {
      if (entry && typeof entry === "object") {
        pushTaskId(entry.task_id);
      }
    }
  }

  return [...taskIds].sort((left, right) => left.localeCompare(right));
}

function chooseManifestPath(candidates) {
  for (const candidate of candidates) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }
  return "";
}

function collectAssetRows() {
  const rows = [];
  for (const spec of REQUIRED_ASSETS) {
    const canonicalExists = pathExists(spec.canonicalPath);
    const mirrorExists = pathExists(spec.mirrorPath);
    const canonicalHash = canonicalExists ? sha256File(spec.canonicalPath) : "";
    const mirrorHash = mirrorExists ? sha256File(spec.mirrorPath) : "";
    const canonicalSizeBytes = canonicalExists ? fs.statSync(spec.canonicalPath).size : 0;
    const manifestPath = chooseManifestPath(spec.manifestCandidates);
    const manifest = manifestPath ? readJsonSafe(manifestPath) : null;
    const manifestTaskIds = collectManifestTaskIds(manifest);

    rows.push({
      ...spec,
      canonicalExists,
      mirrorExists,
      canonicalHash,
      mirrorHash,
      canonicalSizeBytes,
      manifestPath,
      manifestTaskIds
    });
  }
  return rows;
}

function collectSharedHashMap(rows) {
  const hashToIds = new Map();
  for (const row of rows) {
    if (!row.canonicalHash) {
      continue;
    }
    if (!hashToIds.has(row.canonicalHash)) {
      hashToIds.set(row.canonicalHash, []);
    }
    hashToIds.get(row.canonicalHash).push(row.assetId);
  }
  return hashToIds;
}

function classifyRow(row, sharedHashMap, options) {
  const blockers = [];
  let sourceType = row.manifestPath ? "meshy-live" : "legacy-approved";

  if (!row.canonicalExists) {
    sourceType = "placeholder-blocked";
    blockers.push("missing canonical GLB under assets/glb");
  } else {
    const sameHashIds = sharedHashMap.get(row.canonicalHash) ?? [];
    if (sameHashIds.length > 1) {
      sourceType = "placeholder-blocked";
      blockers.push(`hash reused by asset IDs: ${sameHashIds.join(", ")}`);
    }
    if (row.canonicalSizeBytes <= options.tinyThresholdBytes) {
      sourceType = "placeholder-blocked";
      blockers.push(`tiny GLB size (${row.canonicalSizeBytes} bytes)`);
    }
  }

  if (options.requireManifests && !row.manifestPath) {
    blockers.push(`missing Meshy manifest evidence (expected ${row.manifestCandidates[0]})`);
  }

  if (!row.mirrorExists) {
    blockers.push("runtime mirror missing in apps/client-web/public/assets");
  } else if (row.canonicalHash && row.mirrorHash !== row.canonicalHash) {
    blockers.push("runtime mirror hash differs from canonical");
  }

  return {
    sourceType,
    blockers
  };
}

function evaluateRows(rows, sharedHashMap, options) {
  return rows.map((row) => ({
    ...row,
    evaluation: classifyRow(row, sharedHashMap, options)
  }));
}

function formatReport({ rows, sharedHashMap, generatedAt, outputPath, options }) {
  const lines = [];
  lines.push("# Asset Provenance Ledger");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Source command: \`node tools/asset-provenance-ledger.mjs --out ${toPosix(outputPath)}\``);
  lines.push(`Gate mode: \`${options.strict ? "strict" : "report-only"}\``);
  lines.push(`Require manifests: \`${options.requireManifests ? "yes" : "no"}\``);
  lines.push("");
  lines.push("Related beads:");
  lines.push(
    `- Epic: \`${TRACEABILITY.epic}\`; credential gate: \`${TRACEABILITY.credentialGate}\`; ledger: \`${TRACEABILITY.ledger}\`; provenance gate: \`${TRACEABILITY.provenanceGate}\``
  );
  lines.push(
    `- Generation tracks: env \`${TRACEABILITY.envGeneration}\`, agent \`${TRACEABILITY.agentGeneration}\``
  );
  lines.push("");
  lines.push(
    "Required production IDs: office_shell, prop_inbox, prop_task_board, prop_delivery_shelf, prop_dev_desk, prop_blocker_cone, agent_base_skeleton, agent_animation_bundle"
  );
  lines.push("");
  lines.push("## Ledger");
  lines.push("");
  lines.push(
    "| asset_id | canonical_path | canonical_sha256 | mirror_path | mirror_sha256 | source_type | evidence_links | gate_blockers | related_br |"
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");

  for (const row of rows) {
    const evidenceParts = [];
    if (row.manifestPath) {
      const manifestTasks =
        row.manifestTaskIds.length > 0 ? ` (task_ids: ${row.manifestTaskIds.join(", ")})` : "";
      evidenceParts.push(`\`${row.manifestPath}\`${manifestTasks}`);
    } else {
      evidenceParts.push(`pending manifest via \`${row.generationBead}\``);
    }
    evidenceParts.push("`reports/asset-budget-summary.md`");
    evidenceParts.push("`reports/meshy-credential-check.bd-dok7.md`");

    const canonicalHash = row.canonicalHash || "missing";
    const mirrorHash = row.mirrorHash || "missing";
    const related = `\`${row.generationBead}\`, \`${TRACEABILITY.ledger}\`, \`${TRACEABILITY.provenanceGate}\``;
    const gateBlockers = row.evaluation.blockers.length
      ? row.evaluation.blockers.join("; ")
      : "none";

    lines.push(
      `| \`${row.assetId}\` | \`${row.canonicalPath}\` | \`${canonicalHash}\` | \`${row.mirrorPath}\` | \`${mirrorHash}\` | \`${row.evaluation.sourceType}\` | ${evidenceParts.join("; ")} | ${gateBlockers} | ${related} |`
    );
  }

  lines.push("");
  lines.push("## Placeholder Hash Audit");
  lines.push("");

  const sharedHashes = [...sharedHashMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort((left, right) => left[0].localeCompare(right[0]));

  if (sharedHashes.length === 0) {
    lines.push("No shared SHA256 hash clusters detected across required production assets.");
  } else {
    lines.push("| sha256 | asset_ids | status |");
    lines.push("|---|---|---|");
    for (const [hash, ids] of sharedHashes) {
      lines.push(`| \`${hash}\` | ${ids.map((id) => `\`${id}\``).join(", ")} | blocker |`);
    }
  }

  lines.push("");
  lines.push("## Gate Blockers");
  lines.push("");
  const blockedRows = rows.filter((row) => row.evaluation.blockers.length > 0);
  if (blockedRows.length === 0) {
    lines.push("No blockers detected.");
  } else {
    for (const row of blockedRows) {
      lines.push(`- \`${row.assetId}\`: ${row.evaluation.blockers.join("; ")}`);
    }
  }

  lines.push("");
  lines.push("## Remediation");
  lines.push("");
  lines.push("1. Generate live Meshy outputs for missing evidence:");
  lines.push(
    "   - `python3 tools/meshy_pipeline.py --image <path> --asset-id <id> --output-dir assets/glb --manifest-out reports/meshy-<asset_id>-manifest.json`"
  );
  lines.push("2. Replace hash-reused/tiny placeholder assets with unique production GLBs.");
  lines.push("3. Resync runtime mirror copies:");
  lines.push("   - `node tools/sync-runtime-assets.mjs`");
  lines.push("4. Re-run strict gate:");
  lines.push(
    "   - `node tools/asset-provenance-ledger.mjs --strict --require-manifests --out reports/asset-provenance-ledger.md`"
  );

  lines.push("");
  lines.push("## Traceability");
  lines.push("");
  lines.push("- `reports/p2r-kickoff.bd-zzou.md`");
  lines.push("- `reports/meshy-credential-check.bd-dok7.md`");
  lines.push("- `reports/asset-budget-summary.md`");
  lines.push("- `reports/asset-provenance-ledger.bd-2yns.md`");
  lines.push("- `reports/meshy-provenance-gate.bd-3eoj.md`");

  return `${lines.join("\n")}\n`;
}

function printStrictFailures(rows) {
  const blockedRows = rows.filter((row) => row.evaluation.blockers.length > 0);
  if (blockedRows.length === 0) {
    console.log("[provenance-gate] PASS: no blockers detected.");
    return 0;
  }

  console.error(`[provenance-gate] FAIL: ${blockedRows.length} asset(s) blocked.`);
  for (const row of blockedRows) {
    console.error(`[provenance-gate] ${row.assetId}: ${row.evaluation.blockers.join("; ")}`);
  }
  return 1;
}

function run() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(`\n${usage()}`);
    process.exit(2);
  }

  const outputPath = path.resolve(args.out);
  const rawRows = collectAssetRows();
  const sharedHashMap = collectSharedHashMap(rawRows);
  const evaluatedRows = evaluateRows(rawRows, sharedHashMap, args);

  const content = formatReport({
    rows: evaluatedRows,
    sharedHashMap,
    generatedAt: new Date().toISOString(),
    outputPath,
    options: args
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`Wrote provenance ledger: ${toPosix(path.relative(process.cwd(), outputPath) || outputPath)}`);

  if (args.strict) {
    const code = printStrictFailures(evaluatedRows);
    if (code !== 0) {
      process.exit(code);
    }
  }
}

run();
