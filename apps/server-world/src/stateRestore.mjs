import fs from "node:fs";
import path from "node:path";

function readJournalRecords(commandJournalPath) {
  if (!commandJournalPath || !fs.existsSync(commandJournalPath)) {
    return [];
  }
  const raw = fs.readFileSync(commandJournalPath, "utf8");
  if (!raw.trim()) {
    return [];
  }
  const records = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (
        parsed &&
        typeof parsed === "object" &&
        Number.isInteger(parsed.journal_seq) &&
        parsed.journal_seq > 0 &&
        parsed.command &&
        typeof parsed.command === "object"
      ) {
        records.push(parsed);
      }
    } catch {
      // ignore malformed lines and continue recovery with valid rows
    }
  }
  records.sort((a, b) => a.journal_seq - b.journal_seq);
  return records;
}

export function createStateRestorationPipeline({
  commandJournalPath = null,
  simulation
} = {}) {
  let ready = false;
  let consistencyOk = true;
  let nextJournalSeq = 1;
  let bootstrapStats = {
    loaded_records: 0,
    replayed_ok: 0,
    replayed_rejected: 0,
    reconciled_ticks: 0
  };

  function bootstrap() {
    bootstrapStats = {
      loaded_records: 0,
      replayed_ok: 0,
      replayed_rejected: 0,
      reconciled_ticks: 0
    };

    const records = readJournalRecords(commandJournalPath);
    bootstrapStats.loaded_records = records.length;
    nextJournalSeq =
      records.length > 0 ? Math.max(...records.map((record) => record.journal_seq)) + 1 : 1;

    for (const record of records) {
      const result = simulation.applyCommand(record.command);
      if (result.ok) {
        bootstrapStats.replayed_ok += 1;
      } else {
        bootstrapStats.replayed_rejected += 1;
      }
    }

    if (bootstrapStats.replayed_ok > 0) {
      simulation.tick(1);
      bootstrapStats.reconciled_ticks = 1;
    }

    const coherence = simulation.validateSnapshot();
    consistencyOk = coherence.ok && bootstrapStats.replayed_rejected === 0;
    ready = true;

    return {
      ...bootstrapStats,
      consistency_ok: consistencyOk,
      consistency_issues: coherence.issues
    };
  }

  function persistCommand(commandPayload, context = {}) {
    if (!commandJournalPath) {
      return;
    }
    const record = {
      journal_seq: nextJournalSeq,
      ts: Date.now(),
      command: commandPayload,
      context
    };
    nextJournalSeq += 1;
    const dir = path.dirname(commandJournalPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(commandJournalPath, `${JSON.stringify(record)}\n`);
  }

  return {
    bootstrap,
    persistCommand,
    canAcceptCommands() {
      return ready && consistencyOk;
    },
    getStats() {
      return {
        ready,
        consistency_ok: consistencyOk,
        command_journal_path: commandJournalPath,
        next_journal_seq: nextJournalSeq,
        ...bootstrapStats
      };
    }
  };
}
