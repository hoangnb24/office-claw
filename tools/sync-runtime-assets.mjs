#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULTS = Object.freeze({
  sourceGlbDir: "assets/glb",
  sourceScenesDir: "assets/scenes",
  targetAssetsDir: "apps/client-web/public/assets",
  targetScenesDir: "apps/client-web/public/scenes",
  checkOnly: false,
  prune: false,
  verbose: false
});

function usage() {
  return [
    "sync-runtime-assets",
    "",
    "Copy canonical authoring assets into runtime-served web paths.",
    "",
    "Default mapping:",
    "  assets/glb/**         -> apps/client-web/public/assets/**",
    "  assets/scenes/**      -> apps/client-web/public/scenes/**",
    "",
    "Options:",
    "  --source-glb <path>      Override source GLB directory",
    "  --source-scenes <path>   Override source scenes directory",
    "  --target-assets <path>   Override target runtime assets directory",
    "  --target-scenes <path>   Override target runtime scenes directory",
    "  --check                  Verify only (no writes). Exits non-zero when drift is found.",
    "  --prune                  Remove stale files in target dirs that are absent from source.",
    "  --verbose                Print unchanged entries in addition to copied/updated files.",
    "  --help                   Show help",
    "",
    "Examples:",
    "  node tools/sync-runtime-assets.mjs",
    "  node tools/sync-runtime-assets.mjs --check",
    "  node tools/sync-runtime-assets.mjs --prune"
  ].join("\n");
}

function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--source-glb" && next) {
      args.sourceGlbDir = next;
      i += 1;
      continue;
    }
    if (token === "--source-scenes" && next) {
      args.sourceScenesDir = next;
      i += 1;
      continue;
    }
    if (token === "--target-assets" && next) {
      args.targetAssetsDir = next;
      i += 1;
      continue;
    }
    if (token === "--target-scenes" && next) {
      args.targetScenesDir = next;
      i += 1;
      continue;
    }
    if (token === "--check") {
      args.checkOnly = true;
      continue;
    }
    if (token === "--prune") {
      args.prune = true;
      continue;
    }
    if (token === "--verbose") {
      args.verbose = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function normalizeRelPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function collectFilesRecursive(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
      } else if (entry.isFile()) {
        files.push(nextPath);
      }
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function matchesGlb(filePath) {
  return filePath.toLowerCase().endsWith(".glb");
}

function matchesScene(filePath) {
  return filePath.toLowerCase().endsWith(".scene.json");
}

function resolveFileSet({ sourceDir, sourceFilter }) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }
  if (!fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourceDir}`);
  }

  const sourceFiles = collectFilesRecursive(sourceDir).filter(sourceFilter);
  return sourceFiles.map((absolutePath) => ({
    absolutePath,
    relativePath: normalizeRelPath(path.relative(sourceDir, absolutePath))
  }));
}

function collectTargetFiles(targetDir, targetFilter) {
  if (!fs.existsSync(targetDir)) {
    return [];
  }
  if (!fs.statSync(targetDir).isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  return collectFilesRecursive(targetDir)
    .filter(targetFilter)
    .map((absolutePath) => normalizeRelPath(path.relative(targetDir, absolutePath)));
}

function syncGroup(config, options) {
  const { label, sourceDir, targetDir, sourceFilter } = config;
  const { checkOnly, prune } = options;
  const results = [];
  const sourceEntries = resolveFileSet({ sourceDir, sourceFilter });
  const sourceRelSet = new Set(sourceEntries.map((entry) => entry.relativePath));

  for (const entry of sourceEntries) {
    const targetPath = path.join(targetDir, entry.relativePath);
    const targetExists = fs.existsSync(targetPath);
    let status = "copied";

    if (targetExists) {
      const sourceHash = hashFile(entry.absolutePath);
      const targetHash = hashFile(targetPath);
      if (sourceHash === targetHash) {
        status = "unchanged";
      } else {
        status = "updated";
      }
    }

    if (!checkOnly && status !== "unchanged") {
      ensureDir(targetPath);
      fs.copyFileSync(entry.absolutePath, targetPath);
      const sourceHash = hashFile(entry.absolutePath);
      const targetHash = hashFile(targetPath);
      if (sourceHash !== targetHash) {
        throw new Error(`Verification failed for ${label} file: ${entry.relativePath}`);
      }
    }

    results.push({
      group: label,
      relativePath: entry.relativePath,
      status
    });
  }

  const targetRelPaths = collectTargetFiles(targetDir, sourceFilter);
  const stale = targetRelPaths.filter((relativePath) => !sourceRelSet.has(relativePath)).sort();
  const pruned = [];

  if (!checkOnly && prune) {
    for (const relativePath of stale) {
      const stalePath = path.join(targetDir, relativePath);
      fs.rmSync(stalePath, { force: true });
      pruned.push(relativePath);
    }
  }

  return {
    entries: results,
    stale,
    pruned,
    sourceCount: sourceEntries.length
  };
}

function printSummary({ args, groups }) {
  const copied = [];
  const updated = [];
  const unchanged = [];
  const stale = [];
  const pruned = [];
  let sourceTotal = 0;

  for (const group of groups) {
    sourceTotal += group.sourceCount;
    for (const entry of group.entries) {
      if (entry.status === "copied") {
        copied.push(entry);
      } else if (entry.status === "updated") {
        updated.push(entry);
      } else {
        unchanged.push(entry);
      }
    }
    for (const stalePath of group.stale) {
      stale.push({ group: group.label, relativePath: stalePath });
    }
    for (const prunedPath of group.pruned) {
      pruned.push({ group: group.label, relativePath: prunedPath });
    }
  }

  const lines = [
    `Mode: ${args.checkOnly ? "check" : "sync"}`,
    `Prune stale outputs: ${args.prune ? "yes" : "no"}`,
    `Source files scanned: ${sourceTotal}`,
    `Copied: ${copied.length}`,
    `Updated: ${updated.length}`,
    `Unchanged: ${unchanged.length}`,
    `Stale: ${stale.length}`,
    `Pruned: ${pruned.length}`
  ];

  console.log(lines.join("\n"));

  const showEntries = [...copied, ...updated];
  if (args.verbose) {
    showEntries.push(...unchanged);
  }

  if (showEntries.length > 0) {
    console.log("\nSynced entries:");
    for (const entry of showEntries) {
      console.log(`- [${entry.group}] ${entry.status}: ${entry.relativePath}`);
    }
  }

  if (stale.length > 0) {
    console.log("\nStale target entries:");
    for (const entry of stale) {
      console.log(`- [${entry.group}] ${entry.relativePath}`);
    }
  }

  if (pruned.length > 0) {
    console.log("\nPruned stale entries:");
    for (const entry of pruned) {
      console.log(`- [${entry.group}] ${entry.relativePath}`);
    }
  }
}

function hasDrift(groups) {
  for (const group of groups) {
    if (group.entries.some((entry) => entry.status !== "unchanged")) {
      return true;
    }
    if (group.stale.length > 0) {
      return true;
    }
  }
  return false;
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

  if (args.help) {
    console.log(usage());
    return;
  }

  const groupConfigs = [
    {
      label: "glb",
      sourceDir: args.sourceGlbDir,
      targetDir: args.targetAssetsDir,
      sourceFilter: matchesGlb
    },
    {
      label: "scene",
      sourceDir: args.sourceScenesDir,
      targetDir: args.targetScenesDir,
      sourceFilter: matchesScene
    }
  ];

  let groups;
  try {
    groups = groupConfigs.map((config) => {
      const outcome = syncGroup(config, args);
      return { ...outcome, label: config.label };
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  printSummary({ args, groups });

  if (args.checkOnly && hasDrift(groups)) {
    console.error(
      "\nDrift detected. Re-run without --check to sync files (and optionally add --prune)."
    );
    process.exit(1);
  }
}

run();
