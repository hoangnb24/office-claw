const TABLES = [
  "projects",
  "tasks",
  "decisions",
  "artifacts",
  "world_events",
  "office_decor",
  "command_receipts"
];

const PRIMARY_KEY_BY_TABLE = {
  projects: "project_id",
  tasks: "task_id",
  decisions: "decision_id",
  artifacts: "artifact_id",
  world_events: "id",
  office_decor: "decor_id",
  command_receipts: "receipt_id"
};

function deriveSeedRowId(table, row) {
  const keyField = PRIMARY_KEY_BY_TABLE[table];
  const explicitId = row[keyField] ?? row.id;
  if (typeof explicitId === "string" && explicitId.trim().length > 0) {
    return explicitId;
  }

  if (table === "command_receipts") {
    const projectId = typeof row.project_id === "string" ? row.project_id.trim() : "";
    const idempotencyKey =
      typeof row.idempotency_key === "string" ? row.idempotency_key.trim() : "";
    if (projectId && idempotencyKey) {
      return `${projectId}::${idempotencyKey}`;
    }
  }

  return null;
}

function clone(value) {
  return structuredClone(value);
}

function cloneTableMap(tableMap) {
  const next = new Map();
  for (const [table, rows] of tableMap.entries()) {
    const copiedRows = new Map();
    for (const [id, row] of rows.entries()) {
      copiedRows.set(id, clone(row));
    }
    next.set(table, copiedRows);
  }
  return next;
}

class InMemoryContext {
  constructor(tableMap, seqByProject) {
    this.tableMap = tableMap;
    this.seqByProject = seqByProject;
  }

  get(table, id) {
    const row = this.#table(table).get(id);
    return row ? clone(row) : null;
  }

  list(table, predicate = () => true) {
    const rows = [];
    for (const row of this.#table(table).values()) {
      if (predicate(row)) {
        rows.push(clone(row));
      }
    }
    return rows;
  }

  insert(table, id, row) {
    const target = this.#table(table);
    if (target.has(id)) {
      throw new Error(`${table}:${id} already exists`);
    }
    target.set(id, clone(row));
    return clone(row);
  }

  upsert(table, id, row) {
    this.#table(table).set(id, clone(row));
    return clone(row);
  }

  delete(table, id) {
    this.#table(table).delete(id);
  }

  nextProjectSeq(projectId) {
    const next = (this.seqByProject.get(projectId) || 0) + 1;
    this.seqByProject.set(projectId, next);
    return next;
  }

  #table(table) {
    const rows = this.tableMap.get(table);
    if (!rows) {
      throw new Error(`Unknown table: ${table}`);
    }
    return rows;
  }
}

export class InMemoryAdapter {
  constructor(seed = {}) {
    this._tables = new Map(TABLES.map((table) => [table, new Map()]));
    this._seqByProject = new Map();
    this.#seed(seed);
  }

  async read(work) {
    const ctx = new InMemoryContext(this._tables, this._seqByProject);
    return work(ctx);
  }

  async transaction(work) {
    const workingTables = cloneTableMap(this._tables);
    const workingSeq = new Map(this._seqByProject);
    const ctx = new InMemoryContext(workingTables, workingSeq);

    try {
      const result = await work(ctx);
      this._tables = workingTables;
      this._seqByProject = workingSeq;
      return result;
    } catch (error) {
      throw error;
    }
  }

  #seed(seed) {
    for (const table of TABLES) {
      const rows = seed[table];
      if (!Array.isArray(rows)) {
        continue;
      }
      for (const row of rows) {
        const keyField = PRIMARY_KEY_BY_TABLE[table];
        const id = deriveSeedRowId(table, row);
        if (!id) {
          throw new Error(`Seed row for ${table} missing primary key (${keyField})`);
        }
        this._tables.get(table).set(id, clone(row));
      }
    }

    const events = seed.world_events || [];
    for (const event of events) {
      const current = this._seqByProject.get(event.project_id) || 0;
      if (event.seq > current) {
        this._seqByProject.set(event.project_id, event.seq);
      }
    }
  }
}
