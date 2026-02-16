#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const FALLBACK_CLIPS = ["Idle", "Walk", "Work_Typing", "Think"];
const CLIP_ALIAS_HINTS = Object.freeze({
  Idle: ["Idle_3", "Standing"],
  Walk: ["Walking", "Running"],
  Work_Typing: ["Sitting_Answering_Questions", "Sitting"],
  Think: ["Sitting_Clap", "Standing", "No", "Yes"],
  Carry: ["Carry_Heavy_Object_Walk"]
});
const MESHY_ACTION_HINTS = Object.freeze({
  Idle: "Idle / standing-breathing",
  Walk: "Walking / casual walk",
  Work_Typing: "Seated work loop (typing-like stand-in if true typing is unavailable)",
  Think: "Thoughtful idle (head-scratch/pondering style)",
  Carry: "Carry object walk (optional)"
});

function usage() {
  return [
    "Meshy work-order wrapper for OfficeClaw",
    "",
    "Usage:",
    "  node tools/meshy-work-order.mjs --asset-id <id> --image <path> [--image <path> ...]",
    "",
    "Options:",
    "  --project-root <path>   Repository root (default: .)",
    "  --asset-id <id>         Target asset identifier (required)",
    "  --image <path>          Image reference path, repeatable (required)",
    "  --scene <path>          Scene manifest path (default: assets/scenes/cozy_office_v0.scene.json)",
    "  --plan <path>           Plan/spec path (default: PLAN.md)",
    "  --renderer <path>       Renderer path (default: apps/client-web/src/scene/agents/AgentRenderer.tsx)",
    "  --notes <text>          Optional notes appended to the work order",
    "  --out <path>            Output markdown path (default: reports/meshy-work-order-<asset-id>.md)",
    "  --dry-run               Validate inputs and print planned output path only",
    "  --help                  Show this help",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    projectRoot: ".",
    assetId: "",
    images: [],
    scene: "assets/scenes/cozy_office_v0.scene.json",
    plan: "PLAN.md",
    renderer: "apps/client-web/src/scene/agents/AgentRenderer.tsx",
    notes: "",
    out: "",
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === "--project-root") {
      args.projectRoot = next;
    } else if (token === "--asset-id") {
      args.assetId = next;
    } else if (token === "--image") {
      args.images.push(next);
    } else if (token === "--scene") {
      args.scene = next;
    } else if (token === "--plan") {
      args.plan = next;
    } else if (token === "--renderer") {
      args.renderer = next;
    } else if (token === "--notes") {
      args.notes = next;
    } else if (token === "--out") {
      args.out = next;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
    index += 1;
  }

  if (!args.help) {
    if (!args.assetId || !args.assetId.trim()) {
      throw new Error("--asset-id is required");
    }
    if (args.images.length === 0) {
      throw new Error("At least one --image path is required");
    }
  }
  return args;
}

function resolvePath(projectRoot, rawPath) {
  if (path.isAbsolute(rawPath)) {
    return path.resolve(rawPath);
  }
  return path.resolve(projectRoot, rawPath);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function relativeDisplayPath(projectRoot, absolutePath) {
  const rel = path.relative(projectRoot, absolutePath);
  if (!rel || rel === ".") {
    return ".";
  }
  if (rel.startsWith("..")) {
    return toPosix(absolutePath);
  }
  return toPosix(rel);
}

function extractPlanClips(planPath) {
  if (!fs.existsSync(planPath)) {
    return [...FALLBACK_CLIPS];
  }
  const lines = fs.readFileSync(planPath, "utf8").split(/\r?\n/);
  const clips = [];
  let inSection = false;

  for (const line of lines) {
    if (!inSection && line.includes("Required animation contract")) {
      inSection = true;
      continue;
    }
    if (!inSection) {
      continue;
    }
    if (line.trim().startsWith("---") || line.trim().startsWith("## ")) {
      break;
    }
    const match = line.match(/^\s*-\s*`([^`]+)`\s*$/);
    if (match) {
      clips.push(match[1].trim());
    }
  }

  return clips.length > 0 ? clips : [...FALLBACK_CLIPS];
}

function extractRendererClips(rendererPath) {
  if (!fs.existsSync(rendererPath)) {
    return [];
  }
  const content = fs.readFileSync(rendererPath, "utf8");
  const match = content.match(/REQUIRED_CLIPS\s*=\s*\[(.*?)\]\s*as const/s);
  if (!match) {
    return [];
  }
  const clips = [];
  const rx = /"([^"]+)"/g;
  let token = rx.exec(match[1]);
  while (token) {
    clips.push(token[1]);
    token = rx.exec(match[1]);
  }
  return clips;
}

function extractSceneSummary(scenePath) {
  if (!fs.existsSync(scenePath)) {
    return {
      pois: [],
      highlightNodes: []
    };
  }
  const parsed = JSON.parse(fs.readFileSync(scenePath, "utf8"));
  const pois = [];
  const nodes = new Set();

  if (Array.isArray(parsed.pois)) {
    for (const poi of parsed.pois) {
      if (typeof poi?.poi_id === "string" && poi.poi_id.trim()) {
        pois.push(poi.poi_id.trim());
      }
      if (Array.isArray(poi?.highlight_nodes)) {
        for (const node of poi.highlight_nodes) {
          if (typeof node === "string" && node.trim()) {
            nodes.add(node.trim());
          }
        }
      }
    }
  }
  if (Array.isArray(parsed.objects)) {
    for (const objectEntry of parsed.objects) {
      if (Array.isArray(objectEntry?.highlight_nodes)) {
        for (const node of objectEntry.highlight_nodes) {
          if (typeof node === "string" && node.trim()) {
            nodes.add(node.trim());
          }
        }
      }
    }
  }

  return {
    pois,
    highlightNodes: [...nodes].sort((left, right) => left.localeCompare(right))
  };
}

function buildWorkOrderMarkdown({
  generatedAt,
  projectRootDisplay,
  imageDisplayPaths,
  imageMissingPaths,
  assetId,
  planClips,
  rendererClips,
  sceneSummary,
  planDisplayPath,
  sceneDisplayPath,
  rendererDisplayPath,
  notes
}) {
  const requiredClips = planClips.filter((clip) => clip !== "Carry");
  const optionalClips = planClips.filter((clip) => clip === "Carry");
  const missingRenderer = requiredClips.filter((clip) => !rendererClips.includes(clip));
  const rendererNote =
    rendererClips.length === 0
      ? "renderer contract not found"
      : missingRenderer.length === 0
        ? "matches required plan contract"
        : `renderer missing required clips: ${JSON.stringify(missingRenderer)}`;

  const imageLines = imageDisplayPaths
    .map((imagePath) => {
      const missingSuffix = imageMissingPaths.has(imagePath) ? " (missing)" : "";
      return `- \`${imagePath}\`${missingSuffix}`;
    })
    .join("\n");
  const requiredLines = requiredClips.map((clip) => `- \`${clip}\``).join("\n");
  const optionalLines =
    optionalClips.length > 0 ? optionalClips.map((clip) => `- \`${clip}\``).join("\n") : "- (none)";

  const actionClipOrder = [];
  for (const clip of [...requiredClips, ...optionalClips, "Carry"]) {
    if (!actionClipOrder.includes(clip)) {
      actionClipOrder.push(clip);
    }
  }
  const actionLines = actionClipOrder
    .map((clip) => `- \`${clip}\`: ${MESHY_ACTION_HINTS[clip] || "Define action in Meshy"}`)
    .join("\n");
  const aliasLines = Object.entries(CLIP_ALIAS_HINTS)
    .map(
      ([clip, aliases]) =>
        `- \`${clip}\` <- ${aliases.map((alias) => `\`${alias}\``).join(", ")}`
    )
    .join("\n");
  const poiLines =
    sceneSummary.pois.slice(0, 10).map((poi) => `- \`${poi}\``).join("\n") || "- (none found)";
  const nodeLines =
    sceneSummary.highlightNodes
      .slice(0, 20)
      .map((node) => `- \`${node}\``)
      .join("\n") || "- (none found)";

  const notesBlock = notes ? `\n## Additional Notes\n\n${notes}\n` : "";

  return `# Meshy GLB Work Order

Generated: ${generatedAt}
Project root: \`${projectRootDisplay}\`
Asset ID: \`${assetId}\`

## Inputs

### Image References
${imageLines}

### Contract Sources
- Plan: \`${planDisplayPath}\`
- Scene manifest: \`${sceneDisplayPath}\`
- Renderer: \`${rendererDisplayPath}\`

## Runtime Animation Contract

Required:
${requiredLines}

Optional:
${optionalLines}

Renderer required clips: \`${JSON.stringify(rendererClips)}\` (${rendererNote})

## Meshy Generation Brief

Use the provided images to keep silhouette, proportions, and outfit direction consistent across all outputs.

1. Generate/iterate base character GLB from image references.
2. Rig the same character identity.
3. Generate animation clips aligned to canonical contract.
4. Export GLB assets into \`assets/glb/\`.

Suggested Meshy action intent by canonical clip:
${actionLines}

## Scene Alignment Snapshot

POIs (first 10):
${poiLines}

Highlight nodes referenced in scene manifest (first 20):
${nodeLines}

## Post-Export Normalization

Canonical naming aliases used in this project:
${aliasLines}

Normalize:
\`\`\`bash
node tools/glb-normalize-clips.mjs --in assets/glb/${assetId}_animations.glb
\`\`\`

Preflight:
\`\`\`bash
node tools/glb-preflight.mjs \\
  --scene ${sceneDisplayPath} \\
  --asset-root assets/glb \\
  --report reports/glb-preflight-report.md
\`\`\`

## Acceptance Checklist

- [ ] Required clips exist with canonical names: ${requiredClips.join(", ")}
- [ ] Optional clips reviewed: ${optionalClips.length > 0 ? optionalClips.join(", ") : "none"}
- [ ] Character scale/pivot warnings reviewed and corrected if needed
- [ ] Scene manifest GLB references resolve under \`assets/glb\`
- [ ] Preflight report has no \`ERROR\` entries
- [ ] Runtime smoke test confirms state-to-clip playback
${notesBlock}`;
}

function ensureParentDirectory(targetPath) {
  const parent = path.dirname(targetPath);
  fs.mkdirSync(parent, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const projectRoot = path.resolve(args.projectRoot);
  const imageAbsolutePaths = args.images.map((imagePath) => resolvePath(projectRoot, imagePath));
  const imageDisplayPaths = imageAbsolutePaths.map((p) => relativeDisplayPath(projectRoot, p));
  const missingImages = imageAbsolutePaths.filter((imagePath) => !fs.existsSync(imagePath));
  if (missingImages.length > 0) {
    const missingDisplay = missingImages
      .map((imagePath) => `- ${relativeDisplayPath(projectRoot, imagePath)}`)
      .join("\n");
    throw new Error(`Image file(s) missing:\n${missingDisplay}`);
  }

  const planPath = resolvePath(projectRoot, args.plan);
  const scenePath = resolvePath(projectRoot, args.scene);
  const rendererPath = resolvePath(projectRoot, args.renderer);
  const outPath = args.out
    ? resolvePath(projectRoot, args.out)
    : resolvePath(projectRoot, `reports/meshy-work-order-${args.assetId}.md`);

  const markdown = buildWorkOrderMarkdown({
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    projectRootDisplay: relativeDisplayPath(projectRoot, projectRoot),
    imageDisplayPaths,
    imageMissingPaths: new Set(missingImages.map((p) => relativeDisplayPath(projectRoot, p))),
    assetId: args.assetId.trim(),
    planClips: extractPlanClips(planPath),
    rendererClips: extractRendererClips(rendererPath),
    sceneSummary: extractSceneSummary(scenePath),
    planDisplayPath: relativeDisplayPath(projectRoot, planPath),
    sceneDisplayPath: relativeDisplayPath(projectRoot, scenePath),
    rendererDisplayPath: relativeDisplayPath(projectRoot, rendererPath),
    notes: args.notes.trim()
  });

  const outDisplay = relativeDisplayPath(projectRoot, outPath);
  if (args.dryRun) {
    process.stdout.write("Dry run summary:\n");
    process.stdout.write(`- project_root: ${relativeDisplayPath(projectRoot, projectRoot)}\n`);
    process.stdout.write(`- asset_id: ${args.assetId.trim()}\n`);
    process.stdout.write(`- images: ${imageDisplayPaths.join(", ")}\n`);
    process.stdout.write(`- output: ${outDisplay}\n`);
    process.stdout.write("- no files were written\n");
    return;
  }

  ensureParentDirectory(outPath);
  fs.writeFileSync(outPath, markdown, "utf8");
  process.stdout.write(`Wrote Meshy work order: ${outDisplay}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ERROR: ${message}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 1;
}
