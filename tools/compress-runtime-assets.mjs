#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GLTF_TRANSFORM_PACKAGE = "@gltf-transform/cli@4.2.1";
const DEFAULT_INPUT_ROOT = "assets/glb";
const DEFAULT_OUTPUT_ROOT = "assets/glb/compressed";
const DEFAULT_TEXTURE_MODE = "auto";
const DEFAULT_ASSETS = [
  "office_shell.glb",
  "inbox.glb",
  "task_board.glb",
  "blocker_cone.glb",
  "desk.glb",
  "shelf.glb"
];

function parseArgs(argv) {
  const options = {
    inputRoot: DEFAULT_INPUT_ROOT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    assets: [...DEFAULT_ASSETS],
    textureMode: DEFAULT_TEXTURE_MODE,
    reportPath: null,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--input-root" && next) {
      options.inputRoot = next;
      index += 1;
      continue;
    }
    if (token === "--output-root" && next) {
      options.outputRoot = next;
      index += 1;
      continue;
    }
    if (token === "--assets" && next) {
      options.assets = next
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      index += 1;
      continue;
    }
    if (token === "--texture-mode" && next) {
      options.textureMode = next;
      index += 1;
      continue;
    }
    if (token === "--report" && next) {
      options.reportPath = next;
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node tools/compress-runtime-assets.mjs [options]",
      "",
      "Options:",
      `  --input-root <path>     Input GLB directory (default: ${DEFAULT_INPUT_ROOT})`,
      `  --output-root <path>    Output GLB directory (default: ${DEFAULT_OUTPUT_ROOT})`,
      `  --assets <csv>          Comma-separated GLB basenames`,
      "  --texture-mode <mode>   auto | webp | ktx2 | none (default: auto)",
      "  --report <path>         Write markdown report",
      "  --dry-run               Print plan without executing",
      ""
    ].join("\n")
  );
}

function commandExists(name) {
  const result = spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function bytesToMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function runTransform(command, inputPath, outputPath) {
  const args = ["--yes", GLTF_TRANSFORM_PACKAGE, command, inputPath, outputPath];
  const result = spawnSync("npx", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`gltf-transform ${command} failed for ${path.basename(inputPath)}\n${details}`);
  }
}

function resolveTextureStage(textureMode, hasKtx) {
  if (textureMode === "none") {
    return "none";
  }
  if (textureMode === "webp") {
    return "webp";
  }
  if (textureMode === "ktx2") {
    return hasKtx ? "etc1s" : "webp";
  }
  if (textureMode === "auto") {
    return hasKtx ? "etc1s" : "webp";
  }
  throw new Error(`Invalid --texture-mode "${textureMode}" (expected auto|webp|ktx2|none).`);
}

function writeReport(reportPath, context) {
  const lines = [
    "# Asset Compression Report (`bd-295o`)",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Toolchain: \`npx ${GLTF_TRANSFORM_PACKAGE}\``,
    `Input root: \`${context.inputRoot}\``,
    `Output root: \`${context.outputRoot}\``,
    `Texture mode requested: \`${context.textureModeRequested}\``,
    `Texture stage applied: \`${context.textureStageApplied}\``,
    `KTX tool available: \`${context.hasKtx ? "yes" : "no"}\``,
    "",
    "## Results",
    "",
    "| Asset | Input Size (MiB) | Output Size (MiB) | Delta (MiB) | Delta % |",
    "|---|---:|---:|---:|---:|"
  ];

  for (const item of context.results) {
    const deltaBytes = item.inputBytes - item.outputBytes;
    const deltaPercent = item.inputBytes > 0 ? (deltaBytes / item.inputBytes) * 100 : 0;
    lines.push(
      `| \`${item.asset}\` | ${bytesToMiB(item.inputBytes)} | ${bytesToMiB(item.outputBytes)} | ${bytesToMiB(deltaBytes)} | ${deltaPercent.toFixed(1)}% |`
    );
  }

  const totals = context.results.reduce(
    (acc, item) => {
      acc.input += item.inputBytes;
      acc.output += item.outputBytes;
      return acc;
    },
    { input: 0, output: 0 }
  );
  const totalDelta = totals.input - totals.output;
  const totalDeltaPercent = totals.input > 0 ? (totalDelta / totals.input) * 100 : 0;

  lines.push("");
  lines.push("## Aggregate");
  lines.push("");
  lines.push(`- Input total: ${bytesToMiB(totals.input)} MiB`);
  lines.push(`- Output total: ${bytesToMiB(totals.output)} MiB`);
  lines.push(`- Savings: ${bytesToMiB(totalDelta)} MiB (${totalDeltaPercent.toFixed(1)}%)`);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Mesh stage uses Draco (`gltf-transform draco`).");
  lines.push("- Texture stage uses WebP fallback when `ktx` is unavailable.");
  lines.push("- Source GLBs are unchanged; compressed assets are written to a separate output root.");

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const hasKtx = commandExists("ktx");
  const textureStage = resolveTextureStage(options.textureMode, hasKtx);

  const records = [];
  const missing = [];

  for (const asset of options.assets) {
    const inputPath = path.join(options.inputRoot, asset);
    if (!fs.existsSync(inputPath)) {
      missing.push(asset);
      continue;
    }

    const outputPath = path.join(options.outputRoot, asset);
    const tempPath = path.join(
      os.tmpdir(),
      `officeclaw-${asset.replace(/[^a-zA-Z0-9_.-]/g, "_")}-${Date.now()}`
    );

    if (!options.dryRun) {
      ensureDir(path.dirname(outputPath));
      runTransform("draco", inputPath, tempPath);
      if (textureStage === "none") {
        fs.copyFileSync(tempPath, outputPath);
      } else {
        runTransform(textureStage, tempPath, outputPath);
      }
      fs.rmSync(tempPath, { force: true });
    }

    const inputBytes = fs.statSync(inputPath).size;
    const outputBytes = options.dryRun ? inputBytes : fs.statSync(outputPath).size;
    records.push({
      asset,
      inputBytes,
      outputBytes
    });
  }

  if (missing.length > 0) {
    throw new Error(`Missing input assets: ${missing.join(", ")}`);
  }

  if (records.length === 0) {
    throw new Error("No assets selected for compression.");
  }

  const summary = {
    inputRoot: options.inputRoot,
    outputRoot: options.outputRoot,
    textureModeRequested: options.textureMode,
    textureStageApplied: textureStage,
    hasKtx,
    dryRun: options.dryRun,
    results: records
  };

  if (options.reportPath) {
    writeReport(options.reportPath, summary);
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
