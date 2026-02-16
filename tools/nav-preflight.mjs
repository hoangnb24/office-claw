#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  cellToWorld,
  createNavGridRuntime,
  findPathOnGrid,
  gridIndex,
  inBounds,
  worldToCell
} from "../apps/server-world/src/nav/pathfinding.mjs";

const DEFAULT_SCENE_PATH = "assets/scenes/cozy_office_v0.scene.json";
const DEFAULT_REPORT_PATH = "reports/nav-preflight-report.md";

const CARDINAL_NEIGHBORS = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 }
];

function usage() {
  return [
    "Usage: node tools/nav-preflight.mjs [--scene <path>] [--out <path>|--report <path>]",
    "",
    "Options:",
    `  --scene <path>   Scene manifest to validate (default: ${DEFAULT_SCENE_PATH})`,
    `  --out <path>     Markdown report output path (default: ${DEFAULT_REPORT_PATH})`,
    "  --report <path>  Alias for --out",
    "  -h, --help       Show usage"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    scene: DEFAULT_SCENE_PATH,
    out: DEFAULT_REPORT_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if ((token === "--scene" || token === "--out" || token === "--report") && next) {
      if (token === "--scene") {
        args.scene = next;
      } else {
        args.out = next;
      }
      index += 1;
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseVec3(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  if (!value.every(isFiniteNumber)) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

function parseBoxCollider(object) {
  if (!object || typeof object !== "object") {
    return null;
  }
  if (!object.collider || object.collider.type !== "box") {
    return null;
  }

  const basePos = parseVec3(object.transform?.pos);
  if (!basePos) {
    return null;
  }

  const sizeRaw = Array.isArray(object.collider.size) ? object.collider.size : [1, 1, 1];
  const offsetRaw = Array.isArray(object.collider.offset) ? object.collider.offset : [0, 0, 0];
  if (sizeRaw.length !== 3 || offsetRaw.length !== 3) {
    return null;
  }

  const size = [
    Math.abs(Number(sizeRaw[0]) || 0),
    Math.abs(Number(sizeRaw[1]) || 0),
    Math.abs(Number(sizeRaw[2]) || 0)
  ];
  const offset = [Number(offsetRaw[0]) || 0, Number(offsetRaw[1]) || 0, Number(offsetRaw[2]) || 0];
  const id =
    typeof object.id === "string" && object.id.trim().length > 0
      ? object.id.trim()
      : "<unnamed_object>";

  return {
    id,
    centerX: basePos[0] + offset[0],
    centerZ: basePos[2] + offset[2],
    halfX: size[0] * 0.5,
    halfZ: size[2] * 0.5
  };
}

function worldAabbToCellBounds(grid, minX, maxX, minZ, maxZ) {
  const worldMinX = grid.origin[0];
  const worldMinZ = grid.origin[1];
  const worldMaxX = grid.origin[0] + grid.width * grid.cellSize;
  const worldMaxZ = grid.origin[1] + grid.height * grid.cellSize;

  if (maxX < worldMinX || minX > worldMaxX || maxZ < worldMinZ || minZ > worldMaxZ) {
    return null;
  }

  const minCol = clamp(Math.floor((minX - grid.origin[0]) / grid.cellSize), 0, grid.width - 1);
  const maxCol = clamp(Math.floor((maxX - grid.origin[0]) / grid.cellSize), 0, grid.width - 1);
  const minRow = clamp(Math.floor((minZ - grid.origin[1]) / grid.cellSize), 0, grid.height - 1);
  const maxRow = clamp(Math.floor((maxZ - grid.origin[1]) / grid.cellSize), 0, grid.height - 1);

  return {
    minCol: Math.min(minCol, maxCol),
    maxCol: Math.max(minCol, maxCol),
    minRow: Math.min(minRow, maxRow),
    maxRow: Math.max(minRow, maxRow)
  };
}

function collectColliderBlockers(manifest, grid) {
  const blockedIndices = new Set();
  const byObject = [];

  for (const object of manifest.objects ?? []) {
    const box = parseBoxCollider(object);
    if (!box) {
      continue;
    }

    const bounds = worldAabbToCellBounds(
      grid,
      box.centerX - box.halfX,
      box.centerX + box.halfX,
      box.centerZ - box.halfZ,
      box.centerZ + box.halfZ
    );

    if (!bounds) {
      byObject.push({
        id: box.id,
        blockedCells: 0
      });
      continue;
    }

    const objectCells = new Set();
    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
        const index = row * grid.width + col;
        objectCells.add(index);
        blockedIndices.add(index);
      }
    }

    byObject.push({
      id: box.id,
      blockedCells: objectCells.size
    });
  }

  byObject.sort((left, right) => left.id.localeCompare(right.id));

  return {
    blockedIndices,
    byObject
  };
}

function applyColliderBlockers(grid, blockedIndices) {
  const walkable = new Uint8Array(grid.walkable);
  for (const cellIndex of blockedIndices) {
    if (cellIndex < 0 || cellIndex >= walkable.length) {
      continue;
    }
    walkable[cellIndex] = 0;
  }

  let blockedCellCount = 0;
  for (let index = 0; index < walkable.length; index += 1) {
    if (walkable[index] === 0) {
      blockedCellCount += 1;
    }
  }

  return {
    ...grid,
    walkable,
    blockedCellCount
  };
}

function isWalkableCell(grid, cell) {
  if (!inBounds(grid, cell)) {
    return false;
  }
  return grid.walkable[gridIndex(grid, cell)] > 0;
}

function nearestWalkableCell(grid, start) {
  if (isWalkableCell(grid, start)) {
    return start;
  }

  const limit = Math.max(grid.width, grid.height);
  for (let radius = 1; radius <= limit; radius += 1) {
    for (let row = start.row - radius; row <= start.row + radius; row += 1) {
      const left = { col: start.col - radius, row };
      if (isWalkableCell(grid, left)) {
        return left;
      }
      const right = { col: start.col + radius, row };
      if (isWalkableCell(grid, right)) {
        return right;
      }
    }

    for (let col = start.col - radius + 1; col <= start.col + radius - 1; col += 1) {
      const top = { col, row: start.row - radius };
      if (isWalkableCell(grid, top)) {
        return top;
      }
      const bottom = { col, row: start.row + radius };
      if (isWalkableCell(grid, bottom)) {
        return bottom;
      }
    }
  }

  return null;
}

function firstWalkableCell(grid) {
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const cell = { col, row };
      if (isWalkableCell(grid, cell)) {
        return cell;
      }
    }
  }
  return null;
}

function parsePlayerSpawn(manifest) {
  return parseVec3(manifest?.spawns?.player);
}

function resolvePathStart(manifest, grid) {
  const spawn = parsePlayerSpawn(manifest);
  if (spawn) {
    return {
      source: "manifest.spawns.player",
      world: spawn
    };
  }

  const cell = firstWalkableCell(grid);
  if (!cell) {
    return {
      source: "none",
      world: null
    };
  }

  return {
    source: "first_walkable_cell",
    world: cellToWorld(grid, cell, 0)
  };
}

function collectConnectedWalkableCount(grid, startWorld) {
  const startCell = worldToCell(grid, startWorld);
  if (!startCell || !isWalkableCell(grid, startCell)) {
    return 0;
  }

  const visited = new Set([gridIndex(grid, startCell)]);
  const queue = [startCell];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    for (const neighbor of CARDINAL_NEIGHBORS) {
      const next = {
        col: current.col + neighbor.col,
        row: current.row + neighbor.row
      };
      if (!isWalkableCell(grid, next)) {
        continue;
      }
      const nextIndex = gridIndex(grid, next);
      if (visited.has(nextIndex)) {
        continue;
      }
      visited.add(nextIndex);
      queue.push(next);
    }
  }

  return visited.size;
}

function validateAnchorReachability(manifest, grid, startWorld) {
  const issues = [];
  const pois = [...(manifest.pois ?? [])].sort((left, right) => {
    const leftId = typeof left.poi_id === "string" ? left.poi_id : "";
    const rightId = typeof right.poi_id === "string" ? right.poi_id : "";
    return leftId.localeCompare(rightId);
  });

  for (const poi of pois) {
    const poiId = typeof poi.poi_id === "string" && poi.poi_id.trim().length > 0 ? poi.poi_id.trim() : "<unknown_poi>";
    const anchors = [...(poi.nav_anchors ?? [])].sort((left, right) => {
      const leftId = typeof left.id === "string" ? left.id : "";
      const rightId = typeof right.id === "string" ? right.id : "";
      return leftId.localeCompare(rightId);
    });

    for (const anchor of anchors) {
      const anchorId =
        typeof anchor.id === "string" && anchor.id.trim().length > 0 ? anchor.id.trim() : "<unknown_anchor>";
      const anchorPos = parseVec3(anchor.pos);

      if (!anchorPos) {
        issues.push({
          severity: "ERROR",
          poiId,
          anchorId,
          reason: "anchor_invalid_position",
          anchorPos: anchor?.pos ?? null,
          anchorCell: null,
          nearestWalkableCell: null,
          details: "Anchor position is missing or not a finite [x,y,z] tuple."
        });
        continue;
      }

      const anchorCell = worldToCell(grid, anchorPos);
      if (!anchorCell) {
        issues.push({
          severity: "ERROR",
          poiId,
          anchorId,
          reason: "anchor_out_of_bounds",
          anchorPos,
          anchorCell: null,
          nearestWalkableCell: null,
          details: "Anchor position maps outside nav grid bounds."
        });
        continue;
      }

      if (!isWalkableCell(grid, anchorCell)) {
        const nearest = nearestWalkableCell(grid, anchorCell);
        issues.push({
          severity: "ERROR",
          poiId,
          anchorId,
          reason: nearest ? "anchor_on_blocked_cell" : "anchor_unreachable",
          anchorPos,
          anchorCell,
          nearestWalkableCell: nearest,
          details: nearest
            ? "Anchor cell is blocked after collider merge."
            : "Anchor cell is blocked and no walkable fallback cell was found."
        });
        continue;
      }

      if (!startWorld) {
        continue;
      }

      const path = findPathOnGrid(grid, startWorld, anchorPos, {
        allowTargetOccupied: true,
        maxSearchNodes: 50_000
      });
      if (!path) {
        issues.push({
          severity: "ERROR",
          poiId,
          anchorId,
          reason: "anchor_unreachable",
          anchorPos,
          anchorCell,
          nearestWalkableCell: null,
          details: "No path found from configured start position to anchor."
        });
      }
    }
  }

  return issues;
}

function formatVec3(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return "n/a";
  }
  return `(${value.map((token) => Number(token).toFixed(3)).join(", ")})`;
}

function formatCell(cell) {
  if (!cell || typeof cell !== "object") {
    return "n/a";
  }
  return `(${cell.col}, ${cell.row})`;
}

function countWalkableCells(grid) {
  return grid.width * grid.height - grid.blockedCellCount;
}

function writeReport(outPath, context) {
  const { args, baseGrid, mergedGrid, colliderStats, start, anchorIssues } = context;
  const totalAnchors = (context.manifest.pois ?? []).reduce(
    (count, poi) => count + (Array.isArray(poi.nav_anchors) ? poi.nav_anchors.length : 0),
    0
  );
  const reasonCounts = new Map();
  for (const issue of anchorIssues) {
    reasonCounts.set(issue.reason, (reasonCounts.get(issue.reason) ?? 0) + 1);
  }

  const lines = [
    "# Nav Preflight Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Scene manifest: \`${args.scene}\``,
    `Report path: \`${args.out}\``,
    "",
    "## Summary",
    "",
    `- POIs checked: ${(context.manifest.pois ?? []).length}`,
    `- Anchors checked: ${totalAnchors}`,
    `- Blocking issues: ${anchorIssues.length}`,
    `- Base grid blocked cells: ${baseGrid.blockedCellCount}`,
    `- Collider-induced blocked cells (unique): ${colliderStats.blockedIndices.size}`,
    `- Collider-induced newly blocked walkable cells: ${colliderStats.newlyBlockedCount}`,
    `- Effective blocked cells after collider merge: ${mergedGrid.blockedCellCount}`,
    `- Effective walkable cells after collider merge: ${countWalkableCells(mergedGrid)}`,
    `- Path-start source: ${start.source}`,
    `- Path-start world position: ${start.world ? formatVec3(start.world) : "n/a"}`,
    ""
  ];

  if (reasonCounts.size > 0) {
    lines.push("### Issue Breakdown", "");
    lines.push("| Reason | Count |");
    lines.push("|---|---:|");
    for (const reason of [...reasonCounts.keys()].sort()) {
      lines.push(`| ${reason} | ${reasonCounts.get(reason)} |`);
    }
    lines.push("");
  }

  lines.push("## Collider Block States", "");
  if (colliderStats.byObject.length === 0) {
    lines.push("No box colliders found under `objects[*].collider`.");
  } else {
    lines.push("| Object ID | Blocked Cells |");
    lines.push("|---|---:|");
    for (const object of colliderStats.byObject) {
      lines.push(`| ${object.id} | ${object.blockedCells} |`);
    }
  }
  lines.push("");

  lines.push("## Anchor Reachability Findings", "");
  if (anchorIssues.length === 0) {
    lines.push("No issues found.");
  } else {
    lines.push("| Severity | POI | Anchor | Reason | Anchor Pos | Anchor Cell | Nearest Walkable | Details |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const issue of anchorIssues) {
      lines.push(
        `| ${issue.severity} | ${issue.poiId} | ${issue.anchorId} | ${issue.reason} | ${formatVec3(
          issue.anchorPos
        )} | ${formatCell(issue.anchorCell)} | ${formatCell(issue.nearestWalkableCell)} | ${issue.details} |`
      );
    }
  }

  lines.push("", "## Gate Behavior", "");
  lines.push("- Exit code `0`: no blocking issues found.");
  lines.push("- Exit code `1`: one or more blocking issues found or scene parsing failed.");
  lines.push("- Re-run command:");
  lines.push(
    `  - \`node tools/nav-preflight.mjs --scene ${args.scene} --out ${args.out}\``
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
}

function sortIssues(issues) {
  return [...issues].sort((left, right) => {
    if (left.poiId !== right.poiId) {
      return left.poiId.localeCompare(right.poiId);
    }
    if (left.anchorId !== right.anchorId) {
      return left.anchorId.localeCompare(right.anchorId);
    }
    return left.reason.localeCompare(right.reason);
  });
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

  const outPath = args.out;

  if (!fs.existsSync(args.scene)) {
    writeReport(outPath, {
      args,
      manifest: {},
      baseGrid: { blockedCellCount: 0, width: 1, height: 1 },
      mergedGrid: { blockedCellCount: 0, width: 1, height: 1 },
      colliderStats: { blockedIndices: new Set(), byObject: [], newlyBlockedCount: 0 },
      start: { source: "none", world: null },
      anchorIssues: [
        {
          severity: "ERROR",
          poiId: "<manifest>",
          anchorId: "n/a",
          reason: "scene_manifest_missing",
          anchorPos: null,
          anchorCell: null,
          nearestWalkableCell: null,
          details: `Scene manifest not found at "${args.scene}".`
        }
      ]
    });
    process.exit(1);
  }

  let manifest;
  try {
    manifest = readJson(args.scene);
  } catch (error) {
    writeReport(outPath, {
      args,
      manifest: {},
      baseGrid: { blockedCellCount: 0, width: 1, height: 1 },
      mergedGrid: { blockedCellCount: 0, width: 1, height: 1 },
      colliderStats: { blockedIndices: new Set(), byObject: [], newlyBlockedCount: 0 },
      start: { source: "none", world: null },
      anchorIssues: [
        {
          severity: "ERROR",
          poiId: "<manifest>",
          anchorId: "n/a",
          reason: "scene_manifest_parse_failed",
          anchorPos: null,
          anchorCell: null,
          nearestWalkableCell: null,
          details: `Failed to parse scene manifest JSON: ${(error && error.message) || String(error)}`
        }
      ]
    });
    process.exit(1);
  }

  if (!manifest?.navigation?.grid || !Array.isArray(manifest?.pois)) {
    writeReport(outPath, {
      args,
      manifest,
      baseGrid: { blockedCellCount: 0, width: 1, height: 1 },
      mergedGrid: { blockedCellCount: 0, width: 1, height: 1 },
      colliderStats: { blockedIndices: new Set(), byObject: [], newlyBlockedCount: 0 },
      start: { source: "none", world: null },
      anchorIssues: [
        {
          severity: "ERROR",
          poiId: "<manifest>",
          anchorId: "n/a",
          reason: "scene_manifest_missing_navigation_or_pois",
          anchorPos: null,
          anchorCell: null,
          nearestWalkableCell: null,
          details: "Scene manifest must include navigation.grid and pois[] for nav preflight."
        }
      ]
    });
    process.exit(1);
  }

  const baseGrid = createNavGridRuntime(manifest.navigation.grid);
  const colliderStats = collectColliderBlockers(manifest, baseGrid);
  const newlyBlockedCount = [...colliderStats.blockedIndices].filter(
    (cellIndex) => baseGrid.walkable[cellIndex] > 0
  ).length;
  colliderStats.newlyBlockedCount = newlyBlockedCount;

  const mergedGrid = applyColliderBlockers(baseGrid, colliderStats.blockedIndices);
  const start = resolvePathStart(manifest, mergedGrid);
  let startCell = start.world ? worldToCell(mergedGrid, start.world) : null;
  if (start.world && !startCell) {
    const fallbackCell = firstWalkableCell(mergedGrid);
    if (fallbackCell) {
      start.source = `${start.source} -> clamped_to_first_walkable`;
      start.world = cellToWorld(mergedGrid, fallbackCell, 0);
      startCell = fallbackCell;
    }
  }

  if (start.world && startCell && !isWalkableCell(mergedGrid, startCell)) {
    const nearby = nearestWalkableCell(mergedGrid, startCell);
    if (nearby) {
      start.source = `${start.source} -> nearest_walkable`;
      start.world = cellToWorld(mergedGrid, nearby, 0);
      startCell = nearby;
    }
  }

  const anchorIssues = sortIssues(validateAnchorReachability(manifest, mergedGrid, start.world));
  const connectedWalkableCount = startCell ? collectConnectedWalkableCount(mergedGrid, start.world) : 0;
  if (start.world && (!startCell || connectedWalkableCount === 0)) {
    anchorIssues.push({
      severity: "ERROR",
      poiId: "<nav_start>",
      anchorId: "player_start",
      reason: "start_unreachable",
      anchorPos: start.world,
      anchorCell: worldToCell(mergedGrid, start.world),
      nearestWalkableCell: null,
      details: "Configured path start is not on a walkable cell and no fallback was found."
    });
  }

  writeReport(outPath, {
    args,
    manifest,
    baseGrid,
    mergedGrid,
    colliderStats,
    start,
    anchorIssues: sortIssues(anchorIssues)
  });

  if (anchorIssues.length > 0) {
    console.error(
      `[nav-preflight] FAIL: ${anchorIssues.length} blocking issue(s). See ${outPath} for details.`
    );
    process.exit(1);
  }

  console.log("[nav-preflight] PASS: no blocking anchor reachability issues found.");
}

main();
