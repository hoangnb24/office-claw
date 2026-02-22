#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_THRESHOLDS = Object.freeze({
  maxResponseP95Ms: 8,
  maxResponseP99Ms: 15,
  minCommandsPerSec: 20,
  maxPeakRssMb: 180
});

function parseArgs(argv) {
  const args = {
    in: null,
    ...DEFAULT_THRESHOLDS
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--in") {
      args.in = next;
      i += 1;
      continue;
    }
    if (token === "--max-response-p95-ms") {
      args.maxResponseP95Ms = Number.parseFloat(next);
      i += 1;
      continue;
    }
    if (token === "--max-response-p99-ms") {
      args.maxResponseP99Ms = Number.parseFloat(next);
      i += 1;
      continue;
    }
    if (token === "--min-commands-per-sec") {
      args.minCommandsPerSec = Number.parseFloat(next);
      i += 1;
      continue;
    }
    if (token === "--max-peak-rss-mb") {
      args.maxPeakRssMb = Number.parseFloat(next);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (typeof args.in !== "string" || args.in.trim().length === 0) {
    throw new Error("--in <path> is required.");
  }

  const numericKeys = [
    "maxResponseP95Ms",
    "maxResponseP99Ms",
    "minCommandsPerSec",
    "maxPeakRssMb"
  ];
  for (const key of numericKeys) {
    if (!Number.isFinite(args[key])) {
      throw new Error(`${key} must be a finite number.`);
    }
  }

  return args;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function readBenchmarkResult(filePath) {
  const absPath = path.resolve(filePath);
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

function numberOrNaN(value) {
  return Number.isFinite(value) ? value : Number.NaN;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = readBenchmarkResult(args.in);

  const observed = {
    responseP95Ms: numberOrNaN(result?.latency_ms?.response?.p95),
    responseP99Ms: numberOrNaN(result?.latency_ms?.response?.p99),
    commandsPerSec: numberOrNaN(result?.throughput?.commands_sent_per_sec),
    peakRssMb: numberOrNaN(result?.memory?.peak_rss_mb_sampled)
  };

  const checks = [
    {
      ok: observed.responseP95Ms <= args.maxResponseP95Ms,
      name: "response_p95_ms",
      observed: observed.responseP95Ms,
      threshold: args.maxResponseP95Ms,
      relation: "<="
    },
    {
      ok: observed.responseP99Ms <= args.maxResponseP99Ms,
      name: "response_p99_ms",
      observed: observed.responseP99Ms,
      threshold: args.maxResponseP99Ms,
      relation: "<="
    },
    {
      ok: observed.commandsPerSec >= args.minCommandsPerSec,
      name: "commands_per_sec",
      observed: observed.commandsPerSec,
      threshold: args.minCommandsPerSec,
      relation: ">="
    },
    {
      ok: observed.peakRssMb <= args.maxPeakRssMb,
      name: "peak_rss_mb",
      observed: observed.peakRssMb,
      threshold: args.maxPeakRssMb,
      relation: "<="
    }
  ];

  const failedChecks = checks.filter((check) => !check.ok || !Number.isFinite(check.observed));
  const payload = {
    input: path.resolve(args.in),
    observed,
    thresholds: {
      max_response_p95_ms: args.maxResponseP95Ms,
      max_response_p99_ms: args.maxResponseP99Ms,
      min_commands_per_sec: args.minCommandsPerSec,
      max_peak_rss_mb: args.maxPeakRssMb
    },
    checks: checks.map((check) => ({
      name: check.name,
      ok: check.ok && Number.isFinite(check.observed),
      observed: check.observed,
      threshold: check.threshold,
      relation: check.relation
    }))
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (failedChecks.length > 0) {
    fail(`Benchmark thresholds failed: ${failedChecks.map((check) => check.name).join(", ")}`);
  }
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
