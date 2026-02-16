#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const REQUIRED_CLIPS = ["Idle", "Walk", "Work_Typing", "Think"];

function parseArgs(argv) {
  const args = {
    scene: "assets/scenes/cozy_office_v0.scene.json",
    assetRoot: "assets/glb",
    report: "reports/glb-preflight-report.md"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--scene" && next) {
      args.scene = next;
      i += 1;
    } else if (token === "--asset-root" && next) {
      args.assetRoot = next;
      i += 1;
    } else if (token === "--report" && next) {
      args.report = next;
      i += 1;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 20) {
    throw new Error("File too small to be a valid GLB");
  }

  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  if (magic !== 0x46546c67 || version !== 2) {
    throw new Error("Unsupported GLB header (expected glTF v2 binary)");
  }

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > buf.length) {
      throw new Error("Invalid GLB chunk length");
    }

    if (chunkType === 0x4e4f534a) {
      const jsonChunk = buf.subarray(chunkStart, chunkEnd).toString("utf8");
      return JSON.parse(jsonChunk.replace(/\u0000+$/, ""));
    }

    offset = chunkEnd;
  }

  throw new Error("JSON chunk not found in GLB");
}

function findGlbFiles(assetRoot) {
  if (!fs.existsSync(assetRoot)) {
    return [];
  }

  return fs
    .readdirSync(assetRoot)
    .filter((name) => name.toLowerCase().endsWith(".glb"))
    .map((name) => path.join(assetRoot, name))
    .sort();
}

function addIssue(issues, severity, file, check, message, remediation) {
  issues.push({ severity, file, check, message, remediation });
}

function collectManifestAssetBasenames(scene) {
  const names = [];
  if (scene.office_shell?.url) {
    names.push(path.basename(scene.office_shell.url));
  }
  for (const obj of scene.objects ?? []) {
    if (obj.url) {
      names.push(path.basename(obj.url));
    }
  }
  return [...new Set(names)];
}

function collectRequiredNodeNames(scene) {
  const names = new Set();
  for (const poi of scene.pois ?? []) {
    for (const node of poi.highlight_nodes ?? []) {
      names.add(node);
    }
  }
  for (const obj of scene.objects ?? []) {
    for (const node of obj.highlight_nodes ?? []) {
      names.add(node);
    }
  }
  return [...names].sort();
}

function checkScaleAndPivot(gltf, filePath, issues) {
  const nodes = gltf.nodes ?? [];
  for (const node of nodes) {
    if (Array.isArray(node.scale)) {
      const [sx = 1, sy = 1, sz = 1] = node.scale;
      if (sx <= 0 || sy <= 0 || sz <= 0) {
        addIssue(
          issues,
          "ERROR",
          filePath,
          "scale",
          `Node "${node.name ?? "<unnamed>"}" has non-positive scale ${JSON.stringify(node.scale)}.`,
          "Reset scale in DCC tool and re-export."
        );
      }
      if ([sx, sy, sz].some((value) => value < 0.01 || value > 20)) {
        addIssue(
          issues,
          "WARN",
          filePath,
          "scale",
          `Node "${node.name ?? "<unnamed>"}" has unusual scale ${JSON.stringify(node.scale)}.`,
          "Confirm 1 unit = 1 meter and normalize object scale before export."
        );
      }
    }

    if (node.mesh !== undefined && Array.isArray(node.translation)) {
      const y = Number(node.translation[1] ?? 0);
      if (Math.abs(y) > 2) {
        addIssue(
          issues,
          "WARN",
          filePath,
          "pivot",
          `Node "${node.name ?? "<unnamed>"}" mesh translation has large Y offset (${y}).`,
          "Check pivot placement; character pivots should be near feet and props near base."
        );
      }
    }
  }
}

function writeReport(reportPath, context) {
  const { args, filesChecked, requiredNodes, issues } = context;
  const errors = issues.filter((item) => item.severity === "ERROR").length;
  const warnings = issues.filter((item) => item.severity === "WARN").length;
  const generatedAt = new Date().toISOString();

  const lines = [
    "# GLB Preflight Report",
    "",
    `Generated: ${generatedAt}`,
    `Scene manifest: \`${args.scene}\``,
    `Asset root: \`${args.assetRoot}\``,
    "",
    "## Summary",
    "",
    `- Files checked: ${filesChecked}`,
    `- Required highlight nodes checked: ${requiredNodes.length}`,
    `- Errors: ${errors}`,
    `- Warnings: ${warnings}`,
    "",
    "## Findings",
    ""
  ];

  if (issues.length === 0) {
    lines.push("No issues found.");
  } else {
    lines.push("| Severity | File | Check | Message | Remediation |");
    lines.push("|---|---|---|---|---|");
    for (const issue of issues) {
      lines.push(
        `| ${issue.severity} | \`${issue.file}\` | ${issue.check} | ${issue.message} | ${issue.remediation} |`
      );
    }
  }

  lines.push("", "## Remediation Guide", "");
  lines.push("- Fix `ERROR` items before using assets in runtime.");
  lines.push("- `WARN` items should be reviewed and accepted or corrected explicitly.");
  lines.push("- Re-run: `node tools/glb-preflight.mjs --scene <scene> --asset-root <dir> --report <path>`");

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const issues = [];

  if (!fs.existsSync(args.scene)) {
    addIssue(
      issues,
      "ERROR",
      args.scene,
      "scene_manifest",
      "Scene manifest file not found.",
      "Pass a valid scene file path via --scene."
    );
    writeReport(args.report, { args, filesChecked: 0, requiredNodes: [], issues });
    process.exit(1);
  }

  const scene = readJson(args.scene);
  const manifestAssetNames = collectManifestAssetBasenames(scene);
  const requiredNodes = collectRequiredNodeNames(scene);

  const glbFiles = findGlbFiles(args.assetRoot);
  const glbByName = new Map(glbFiles.map((filePath) => [path.basename(filePath), filePath]));

  for (const assetName of manifestAssetNames) {
    if (!glbByName.has(assetName)) {
      addIssue(
        issues,
        "ERROR",
        assetName,
        "manifest_asset_reference",
        `Manifest references "${assetName}" but file is missing under ${args.assetRoot}.`,
        "Export/copy the referenced GLB into the asset root or fix manifest URL."
      );
    }
  }

  const globalNodeNames = new Set();

  for (const filePath of glbFiles) {
    let gltf;
    try {
      gltf = parseGlbJson(filePath);
    } catch (error) {
      addIssue(
        issues,
        "ERROR",
        filePath,
        "glb_parse",
        `Failed to parse GLB: ${(error && error.message) || String(error)}`,
        "Re-export the file as glTF binary (.glb) version 2."
      );
      continue;
    }

    const nodeNames = (gltf.nodes ?? [])
      .map((node) => node?.name)
      .filter((name) => typeof name === "string");
    for (const nodeName of nodeNames) {
      globalNodeNames.add(nodeName);
    }

    const animationNames = (gltf.animations ?? [])
      .map((anim, index) => anim?.name || `Animation_${index}`)
      .filter((name) => typeof name === "string");

    const basename = path.basename(filePath).toLowerCase();
    const isAgentAnimationAsset = basename.includes("agent") && basename.includes("animation");
    if (isAgentAnimationAsset) {
      if (animationNames.length === 0) {
        addIssue(
          issues,
          "ERROR",
          filePath,
          "required_clips",
          "Agent asset has no animations.",
          `Include required clips: ${REQUIRED_CLIPS.join(", ")}.`
        );
      } else {
        for (const clipName of REQUIRED_CLIPS) {
          if (!animationNames.includes(clipName)) {
            addIssue(
              issues,
              "ERROR",
              filePath,
              "required_clips",
              `Missing required clip "${clipName}". Found: ${animationNames.join(", ")}.`,
              "Rename/export clip with the required canonical name."
            );
          }
        }
      }
    }

    checkScaleAndPivot(gltf, filePath, issues);
  }

  for (const requiredNode of requiredNodes) {
    if (!globalNodeNames.has(requiredNode)) {
      addIssue(
        issues,
        "ERROR",
        requiredNode,
        "highlight_node",
        `Required highlight node "${requiredNode}" is not present in checked GLBs.`,
        "Add/rename the node in source assets or update manifest highlight_nodes."
      );
    }
  }

  writeReport(args.report, {
    args,
    filesChecked: glbFiles.length,
    requiredNodes,
    issues
  });

  const errorCount = issues.filter((item) => item.severity === "ERROR").length;
  if (errorCount > 0) {
    console.error(`GLB preflight completed with ${errorCount} error(s). Report: ${args.report}`);
    process.exit(1);
  }

  console.log(`GLB preflight passed. Report: ${args.report}`);
}

run();
