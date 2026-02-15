#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const REQUIRED_CLIPS = ["Idle", "Walk", "Work_Typing", "Think"];

const PRESETS = {
  "meshy-agent-v0": {
    Idle: ["Idle_3", "Standing"],
    Walk: ["Walking", "Running"],
    Work_Typing: ["Sitting_Answering_Questions", "Sitting"],
    Think: ["Sitting_Clap", "Standing", "No", "Yes"],
    Carry: ["Carry_Heavy_Object_Walk"]
  }
};

function printUsage() {
  console.log(`GLB clip normalizer

Usage:
  node tools/glb-normalize-clips.mjs --in <input.glb> [--out <output.glb>] [--preset <name>] [--dry-run] [--allow-missing]

Options:
  --in <path>           Input GLB file path (required)
  --out <path>          Output GLB file path (default: overwrite input)
  --preset <name>       Mapping preset (default: meshy-agent-v0)
  --dry-run             Print planned changes without writing output
  --allow-missing       Exit 0 even if required clips are still missing
  --help                Show this help

Examples:
  node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb
  node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --out assets/glb/agent1_animations.normalized.glb
  node tools/glb-normalize-clips.mjs --in assets/glb/agent1_animations.glb --dry-run
`);
}

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    preset: "meshy-agent-v0",
    dryRun: false,
    allowMissing: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--in" && next) {
      args.input = next;
      i += 1;
      continue;
    }
    if (token === "--out" && next) {
      args.output = next;
      i += 1;
      continue;
    }
    if (token === "--preset" && next) {
      args.preset = next;
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--allow-missing") {
      args.allowMissing = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.output && args.input) {
    args.output = args.input;
  }
  return args;
}

function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 20) {
    throw new Error("File too small to be valid GLB");
  }

  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  if (magic !== GLB_MAGIC || version !== GLB_VERSION) {
    throw new Error("Unsupported GLB header; expected glTF binary v2");
  }

  const chunks = [];
  let offset = 12;

  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > buf.length) {
      throw new Error("Invalid GLB chunk length");
    }

    chunks.push({
      chunkType,
      data: Buffer.from(buf.subarray(chunkStart, chunkEnd))
    });

    offset = chunkEnd;
  }

  const jsonChunkIndex = chunks.findIndex((chunk) => chunk.chunkType === JSON_CHUNK_TYPE);
  if (jsonChunkIndex < 0) {
    throw new Error("JSON chunk not found in GLB");
  }

  const jsonText = chunks[jsonChunkIndex].data.toString("utf8").replace(/\u0000+$/, "").trimEnd();
  const gltf = JSON.parse(jsonText);
  return { chunks, jsonChunkIndex, gltf };
}

function padBuffer(buffer, padByte) {
  const remainder = buffer.length % 4;
  if (remainder === 0) {
    return buffer;
  }
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, padByte)]);
}

function buildGlb(chunks) {
  const totalLength = 12 + chunks.reduce((acc, chunk) => acc + 8 + chunk.data.length, 0);
  const out = Buffer.alloc(totalLength);
  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(GLB_VERSION, 4);
  out.writeUInt32LE(totalLength, 8);

  let offset = 12;
  for (const chunk of chunks) {
    out.writeUInt32LE(chunk.data.length, offset);
    out.writeUInt32LE(chunk.chunkType, offset + 4);
    chunk.data.copy(out, offset + 8);
    offset += 8 + chunk.data.length;
  }

  return out;
}

function findAnimationIndexByName(animations, name) {
  for (let i = 0; i < animations.length; i += 1) {
    if (animations[i]?.name === name) {
      return i;
    }
  }
  return -1;
}

function normalizeClipNames(gltf, preset) {
  if (!Array.isArray(gltf.animations)) {
    gltf.animations = [];
  }
  const animations = gltf.animations;
  const mappingOrder = [...REQUIRED_CLIPS, "Carry"];
  const renamed = [];

  for (const target of mappingOrder) {
    if (findAnimationIndexByName(animations, target) >= 0) {
      continue;
    }

    const aliases = preset[target] ?? [];
    for (const alias of aliases) {
      const index = findAnimationIndexByName(animations, alias);
      if (index < 0) {
        continue;
      }
      animations[index].name = target;
      renamed.push({ from: alias, to: target });
      break;
    }
  }

  const clipNames = animations.map((anim, index) => anim?.name ?? `<unnamed_${index}>`);
  const missingRequired = REQUIRED_CLIPS.filter((required) => !clipNames.includes(required));

  return { renamed, clipNames, missingRequired };
}

function run() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${(error && error.message) || String(error)}`);
    printUsage();
    process.exit(1);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.input) {
    console.error("Error: --in is required.");
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(args.input)) {
    console.error(`Error: input file not found: ${args.input}`);
    process.exit(1);
  }

  const preset = PRESETS[args.preset];
  if (!preset) {
    console.error(
      `Error: unknown preset "${args.preset}". Available presets: ${Object.keys(PRESETS).join(", ")}`
    );
    process.exit(1);
  }

  const { chunks, jsonChunkIndex, gltf } = parseGlb(args.input);
  const beforeNames = (gltf.animations ?? []).map((anim, index) => anim?.name ?? `<unnamed_${index}>`);
  const { renamed, clipNames, missingRequired } = normalizeClipNames(gltf, preset);

  console.log(`Input:  ${args.input}`);
  console.log(`Output: ${args.output}`);
  console.log(`Preset: ${args.preset}`);
  console.log("");
  console.log("Before:");
  console.log(`  ${beforeNames.join(", ") || "(no animations)"}`);
  console.log("");
  console.log("After:");
  console.log(`  ${clipNames.join(", ") || "(no animations)"}`);
  console.log("");

  if (renamed.length === 0) {
    console.log("Renamed clips: (none)");
  } else {
    console.log("Renamed clips:");
    for (const item of renamed) {
      console.log(`  - ${item.from} -> ${item.to}`);
    }
  }

  if (missingRequired.length > 0) {
    console.log("");
    console.log(`Missing required clips: ${missingRequired.join(", ")}`);
  }

  if (!args.dryRun) {
    const jsonBuffer = padBuffer(Buffer.from(JSON.stringify(gltf), "utf8"), 0x20);
    chunks[jsonChunkIndex] = {
      ...chunks[jsonChunkIndex],
      data: jsonBuffer
    };
    const outBuffer = buildGlb(chunks);
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, outBuffer);
    console.log("");
    console.log(`Wrote normalized GLB: ${args.output}`);
  } else {
    console.log("");
    console.log("Dry run complete. No file written.");
  }

  if (missingRequired.length > 0 && !args.allowMissing) {
    process.exit(1);
  }
}

run();
