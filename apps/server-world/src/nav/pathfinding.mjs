const CARDINAL_NEIGHBORS = [
  { col: 1, row: 0, stepCost: 1 },
  { col: -1, row: 0, stepCost: 1 },
  { col: 0, row: 1, stepCost: 1 },
  { col: 0, row: -1, stepCost: 1 }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseRleWalkable(raw, expected) {
  if (!raw.startsWith("rle:")) {
    return null;
  }

  const body = raw.slice(4).trim();
  if (!body) {
    return null;
  }

  const values = [];
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

function normalizeWalkable(walkable, expected) {
  const normalized = new Uint8Array(expected).fill(1);

  let rawValues = null;
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

export function createNavGridRuntime(grid) {
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

export function gridIndex(grid, cell) {
  return cell.row * grid.width + cell.col;
}

export function inBounds(grid, cell) {
  return cell.col >= 0 && cell.col < grid.width && cell.row >= 0 && cell.row < grid.height;
}

export function cellToWorld(grid, cell, y = 0) {
  const x = grid.origin[0] + (cell.col + 0.5) * grid.cellSize;
  const z = grid.origin[1] + (cell.row + 0.5) * grid.cellSize;
  return [x, y, z];
}

export function worldToCell(grid, world) {
  const col = Math.floor((world[0] - grid.origin[0]) / grid.cellSize);
  const row = Math.floor((world[2] - grid.origin[1]) / grid.cellSize);
  const cell = { col, row };
  return inBounds(grid, cell) ? cell : null;
}

function clampedWorldCell(grid, world) {
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

function collectOccupiedCellIndices(grid, occupiedWorldPositions) {
  const occupied = new Set();
  for (const position of occupiedWorldPositions) {
    const cell = worldToCell(grid, position);
    if (!cell) {
      continue;
    }
    occupied.add(gridIndex(grid, cell));
  }
  return occupied;
}

function isWalkableCell(grid, cell, occupiedCells, allowOccupied = false) {
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

function nearestWalkableCell(grid, start, occupiedCells, allowOccupied = false) {
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

function heuristicCost(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function reconstructPath(grid, cameFrom, nodeIndex) {
  const cells = [];
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

export function findPathOnGrid(grid, startWorld, targetWorld, options = {}) {
  const occupied = collectOccupiedCellIndices(grid, options.occupiedWorldPositions ?? []);
  const clampedStart = worldToCell(grid, startWorld) ?? clampedWorldCell(grid, startWorld);
  const clampedTarget = worldToCell(grid, targetWorld) ?? clampedWorldCell(grid, targetWorld);
  const allowTargetOccupied = options.allowTargetOccupied ?? false;

  const startCell = nearestWalkableCell(grid, clampedStart, occupied, true);
  if (!startCell) {
    return null;
  }
  const targetCell = nearestWalkableCell(grid, clampedTarget, occupied, allowTargetOccupied);
  if (!targetCell) {
    return null;
  }

  const nodeCount = grid.width * grid.height;
  const open = new Set();
  const closed = new Set();
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

      if (!isWalkableCell(grid, nextCell, occupied, allowTargetOccupied && nextIndex === targetIndex)) {
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

export function serializeNavGrid(grid) {
  return {
    origin: [...grid.origin],
    cell_size: grid.cellSize,
    width: grid.width,
    height: grid.height,
    blocked_cell_count: grid.blockedCellCount,
    walkable: Array.from(grid.walkable)
  };
}
