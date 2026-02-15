import type { SceneManifest, SceneObjectSpec } from "../loader";

export interface NavGridCell {
  col: number;
  row: number;
}

export interface NavGridRuntime {
  origin: [number, number];
  cellSize: number;
  width: number;
  height: number;
  walkable: Uint8Array;
  blockedCellCount: number;
}

export interface NavPathResult {
  path: [number, number, number][];
  cells: NavGridCell[];
  startCell: NavGridCell;
  targetCell: NavGridCell;
  occupiedCellCount: number;
}

export interface NavPathOptions {
  occupiedWorldPositions?: [number, number, number][];
  y?: number;
  maxSearchNodes?: number;
}

export interface ColliderBlockerResult {
  blockedIndices: Set<number>;
  blockedCount: number;
}

export interface NavAnchorReachabilityIssue {
  poiId: string;
  anchorId: string;
  anchorPos: [number, number, number];
  reason:
    | "anchor_out_of_bounds"
    | "anchor_on_blocked_cell"
    | "anchor_unreachable";
  nearestWalkableCell?: NavGridCell;
}

type SceneNavigationGrid = SceneManifest["navigation"]["grid"];

interface AStarNeighbor {
  col: number;
  row: number;
  stepCost: number;
}

const CARDINAL_NEIGHBORS: AStarNeighbor[] = [
  { col: 1, row: 0, stepCost: 1 },
  { col: -1, row: 0, stepCost: 1 },
  { col: 0, row: 1, stepCost: 1 },
  { col: 0, row: -1, stepCost: 1 }
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gridIndex(grid: NavGridRuntime, cell: NavGridCell): number {
  return cell.row * grid.width + cell.col;
}

function inBounds(grid: NavGridRuntime, cell: NavGridCell): boolean {
  return cell.col >= 0 && cell.col < grid.width && cell.row >= 0 && cell.row < grid.height;
}

function parseRleWalkable(raw: string, expected: number): number[] | null {
  if (!raw.startsWith("rle:")) {
    return null;
  }

  const body = raw.slice(4).trim();
  if (!body) {
    return null;
  }

  const values: number[] = [];
  for (const token of body.split(",")) {
    const segment = token.trim();
    if (!segment) {
      continue;
    }

    const repeated = /^(\d+)\s*[*x:]\s*([01])$/.exec(segment);
    if (repeated) {
      const count = Number(repeated[1]);
      const value = Number(repeated[2]);
      for (let idx = 0; idx < count; idx += 1) {
        values.push(value);
      }
      continue;
    }

    if (segment === "0" || segment === "1") {
      values.push(Number(segment));
      continue;
    }

    return null;
  }

  if (values.length === 0) {
    return null;
  }

  if (values.length < expected) {
    while (values.length < expected) {
      values.push(1);
    }
  }

  if (values.length > expected) {
    values.length = expected;
  }

  return values;
}

function normalizeWalkable(walkable: number[] | string, expected: number): Uint8Array {
  const normalized = new Uint8Array(expected).fill(1);

  let rawValues: number[] | null = null;
  if (Array.isArray(walkable)) {
    rawValues = walkable.map((value) => (Number(value) > 0 ? 1 : 0));
  } else if (typeof walkable === "string") {
    const trimmed = walkable.trim();
    rawValues =
      parseRleWalkable(trimmed, expected) ??
      (trimmed.length === expected && /^[01]+$/.test(trimmed)
        ? [...trimmed].map((token) => (token === "1" ? 1 : 0))
        : null);
  }

  if (!rawValues) {
    return normalized;
  }

  const limit = Math.min(expected, rawValues.length);
  for (let idx = 0; idx < limit; idx += 1) {
    normalized[idx] = rawValues[idx] > 0 ? 1 : 0;
  }

  return normalized;
}

export function createNavGridRuntime(grid: SceneNavigationGrid): NavGridRuntime {
  const width = Math.max(1, Math.floor(grid.width));
  const height = Math.max(1, Math.floor(grid.height));
  const cellSize = Number.isFinite(grid.cell_size) && grid.cell_size > 0 ? grid.cell_size : 0.25;
  const expected = width * height;
  const walkable = normalizeWalkable(grid.walkable, expected);

  let blockedCellCount = 0;
  for (let idx = 0; idx < walkable.length; idx += 1) {
    if (walkable[idx] === 0) {
      blockedCellCount += 1;
    }
  }

  return {
    origin: grid.origin,
    cellSize,
    width,
    height,
    walkable,
    blockedCellCount
  };
}

export function cellToWorld(
  grid: NavGridRuntime,
  cell: NavGridCell,
  y = 0
): [number, number, number] {
  const x = grid.origin[0] + (cell.col + 0.5) * grid.cellSize;
  const z = grid.origin[1] + (cell.row + 0.5) * grid.cellSize;
  return [x, y, z];
}

export function worldToCell(grid: NavGridRuntime, world: [number, number, number]): NavGridCell | null {
  const col = Math.floor((world[0] - grid.origin[0]) / grid.cellSize);
  const row = Math.floor((world[2] - grid.origin[1]) / grid.cellSize);
  const cell = { col, row };
  return inBounds(grid, cell) ? cell : null;
}

function clampedWorldCell(grid: NavGridRuntime, world: [number, number, number]): NavGridCell {
  const col = clamp(
    Math.floor((world[0] - grid.origin[0]) / grid.cellSize),
    0,
    grid.width - 1
  );
  const row = clamp(
    Math.floor((world[2] - grid.origin[1]) / grid.cellSize),
    0,
    grid.height - 1
  );
  return { col, row };
}

function collectOccupiedCellIndices(
  grid: NavGridRuntime,
  occupiedWorldPositions: [number, number, number][]
): Set<number> {
  const occupied = new Set<number>();
  for (const position of occupiedWorldPositions) {
    const cell = worldToCell(grid, position);
    if (!cell) {
      continue;
    }
    occupied.add(gridIndex(grid, cell));
  }
  return occupied;
}

function worldAabbToCellBounds(
  grid: NavGridRuntime,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
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

function boxColliderCells(
  grid: NavGridRuntime,
  object: SceneObjectSpec
): Set<number> {
  const cells = new Set<number>();
  if (!object.collider || object.collider.type !== "box") {
    return cells;
  }

  const size = object.collider.size ?? [1, 1, 1];
  const offset = object.collider.offset ?? [0, 0, 0];
  const centerX = object.transform.pos[0] + offset[0];
  const centerZ = object.transform.pos[2] + offset[2];
  const halfX = Math.abs(size[0]) * 0.5;
  const halfZ = Math.abs(size[2]) * 0.5;

  const bounds = worldAabbToCellBounds(
    grid,
    centerX - halfX,
    centerX + halfX,
    centerZ - halfZ,
    centerZ + halfZ
  );
  if (!bounds) {
    return cells;
  }

  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      cells.add(row * grid.width + col);
    }
  }
  return cells;
}

function isWalkableCell(
  grid: NavGridRuntime,
  cell: NavGridCell,
  occupiedCells: Set<number>,
  allowOccupied = false
): boolean {
  if (!inBounds(grid, cell)) {
    return false;
  }
  const index = gridIndex(grid, cell);
  if (grid.walkable[index] === 0) {
    return false;
  }
  if (!allowOccupied && occupiedCells.has(index)) {
    return false;
  }
  return true;
}

function nearestWalkableCell(
  grid: NavGridRuntime,
  start: NavGridCell,
  occupiedCells: Set<number>,
  allowOccupied = false
): NavGridCell | null {
  if (isWalkableCell(grid, start, occupiedCells, allowOccupied)) {
    return start;
  }

  const limit = Math.max(grid.width, grid.height);
  for (let radius = 1; radius <= limit; radius += 1) {
    for (let row = start.row - radius; row <= start.row + radius; row += 1) {
      const left = { col: start.col - radius, row };
      if (isWalkableCell(grid, left, occupiedCells, allowOccupied)) {
        return left;
      }
      const right = { col: start.col + radius, row };
      if (isWalkableCell(grid, right, occupiedCells, allowOccupied)) {
        return right;
      }
    }

    for (let col = start.col - radius + 1; col <= start.col + radius - 1; col += 1) {
      const top = { col, row: start.row - radius };
      if (isWalkableCell(grid, top, occupiedCells, allowOccupied)) {
        return top;
      }
      const bottom = { col, row: start.row + radius };
      if (isWalkableCell(grid, bottom, occupiedCells, allowOccupied)) {
        return bottom;
      }
    }
  }

  return null;
}

function heuristicCost(a: NavGridCell, b: NavGridCell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function reconstructPath(
  grid: NavGridRuntime,
  cameFrom: Int32Array,
  nodeIndex: number
): NavGridCell[] {
  const cells: NavGridCell[] = [];
  let cursor = nodeIndex;
  while (cursor >= 0) {
    const row = Math.floor(cursor / grid.width);
    const col = cursor - row * grid.width;
    cells.push({ col, row });
    cursor = cameFrom[cursor];
  }
  cells.reverse();
  return cells;
}

export function findPathOnGrid(
  grid: NavGridRuntime,
  startWorld: [number, number, number],
  targetWorld: [number, number, number],
  options: NavPathOptions = {}
): NavPathResult | null {
  const occupied = collectOccupiedCellIndices(grid, options.occupiedWorldPositions ?? []);
  const clampedStart = worldToCell(grid, startWorld) ?? clampedWorldCell(grid, startWorld);
  const clampedTarget = worldToCell(grid, targetWorld) ?? clampedWorldCell(grid, targetWorld);

  const startCell = nearestWalkableCell(grid, clampedStart, occupied, true);
  if (!startCell) {
    return null;
  }
  const targetCell = nearestWalkableCell(grid, clampedTarget, occupied, true);
  if (!targetCell) {
    return null;
  }

  const nodeCount = grid.width * grid.height;
  const open = new Set<number>();
  const closed = new Set<number>();
  const gScore = new Float64Array(nodeCount).fill(Number.POSITIVE_INFINITY);
  const fScore = new Float64Array(nodeCount).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(nodeCount).fill(-1);

  const startIndex = gridIndex(grid, startCell);
  const targetIndex = gridIndex(grid, targetCell);
  open.add(startIndex);
  gScore[startIndex] = 0;
  fScore[startIndex] = heuristicCost(startCell, targetCell);

  const maxSearchNodes = options.maxSearchNodes ?? 20_000;
  let visited = 0;

  while (open.size > 0) {
    let currentIndex = -1;
    let currentFScore = Number.POSITIVE_INFINITY;
    for (const candidate of open) {
      if (fScore[candidate] < currentFScore) {
        currentFScore = fScore[candidate];
        currentIndex = candidate;
      }
    }
    if (currentIndex < 0) {
      break;
    }

    if (currentIndex === targetIndex) {
      const cells = reconstructPath(grid, cameFrom, currentIndex);
      const y = options.y ?? startWorld[1];
      const path = cells.map((cell) => cellToWorld(grid, cell, y));
      const last = path[path.length - 1];
      if (
        !last ||
        Math.abs(last[0] - targetWorld[0]) > 1e-3 ||
        Math.abs(last[2] - targetWorld[2]) > 1e-3
      ) {
        path.push([targetWorld[0], y, targetWorld[2]]);
      }

      return {
        path,
        cells,
        startCell,
        targetCell,
        occupiedCellCount: occupied.size
      };
    }

    open.delete(currentIndex);
    closed.add(currentIndex);

    const currentRow = Math.floor(currentIndex / grid.width);
    const currentCol = currentIndex - currentRow * grid.width;

    for (const neighbor of CARDINAL_NEIGHBORS) {
      const nextCell = {
        col: currentCol + neighbor.col,
        row: currentRow + neighbor.row
      };
      if (!inBounds(grid, nextCell)) {
        continue;
      }

      const nextIndex = gridIndex(grid, nextCell);
      if (closed.has(nextIndex)) {
        continue;
      }

      if (!isWalkableCell(grid, nextCell, occupied, nextIndex === targetIndex)) {
        continue;
      }

      const tentativeG = gScore[currentIndex] + neighbor.stepCost;
      if (!open.has(nextIndex)) {
        open.add(nextIndex);
      } else if (tentativeG >= gScore[nextIndex]) {
        continue;
      }

      cameFrom[nextIndex] = currentIndex;
      gScore[nextIndex] = tentativeG;
      fScore[nextIndex] = tentativeG + heuristicCost(nextCell, targetCell);
    }

    visited += 1;
    if (visited >= maxSearchNodes) {
      break;
    }
  }

  return null;
}

export function collectColliderBlockedIndices(
  manifest: SceneManifest,
  grid: NavGridRuntime
): ColliderBlockerResult {
  const blockedIndices = new Set<number>();
  for (const object of manifest.objects) {
    const objectIndices = boxColliderCells(grid, object);
    for (const cellIndex of objectIndices) {
      blockedIndices.add(cellIndex);
    }
  }

  return {
    blockedIndices,
    blockedCount: blockedIndices.size
  };
}

export function applyColliderBlockers(
  grid: NavGridRuntime,
  blockedIndices: Set<number>
): NavGridRuntime {
  const walkable = new Uint8Array(grid.walkable);
  for (const cellIndex of blockedIndices) {
    if (cellIndex < 0 || cellIndex >= walkable.length) {
      continue;
    }
    walkable[cellIndex] = 0;
  }

  let blockedCellCount = 0;
  for (let idx = 0; idx < walkable.length; idx += 1) {
    if (walkable[idx] === 0) {
      blockedCellCount += 1;
    }
  }

  return {
    ...grid,
    walkable,
    blockedCellCount
  };
}

export function validatePoiAnchorReachability(
  manifest: SceneManifest,
  grid: NavGridRuntime,
  occupiedWorldPositions: [number, number, number][] = []
): NavAnchorReachabilityIssue[] {
  const issues: NavAnchorReachabilityIssue[] = [];
  const occupied = collectOccupiedCellIndices(grid, occupiedWorldPositions);

  for (const poi of manifest.pois) {
    for (const anchor of poi.nav_anchors) {
      const anchorCell = worldToCell(grid, anchor.pos);
      if (!anchorCell) {
        issues.push({
          poiId: poi.poi_id,
          anchorId: anchor.id,
          anchorPos: anchor.pos,
          reason: "anchor_out_of_bounds"
        });
        continue;
      }

      if (isWalkableCell(grid, anchorCell, occupied, false)) {
        continue;
      }

      const nearest = nearestWalkableCell(grid, anchorCell, occupied, false);
      if (!nearest) {
        issues.push({
          poiId: poi.poi_id,
          anchorId: anchor.id,
          anchorPos: anchor.pos,
          reason: "anchor_unreachable"
        });
        continue;
      }

      issues.push({
        poiId: poi.poi_id,
        anchorId: anchor.id,
        anchorPos: anchor.pos,
        reason: "anchor_on_blocked_cell",
        nearestWalkableCell: nearest
      });
    }
  }

  return issues;
}

export function blockedCellCenters(
  grid: NavGridRuntime,
  y = 0.02,
  limit = 256
): [number, number, number][] {
  const centers: [number, number, number][] = [];
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      if (grid.walkable[index] > 0) {
        continue;
      }
      centers.push(cellToWorld(grid, { col, row }, y));
      if (centers.length >= limit) {
        return centers;
      }
    }
  }
  return centers;
}
