#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BEAD_ID=""
QUERY=""
DAYS=30
LIMIT=8
FIELDS="summary"
AGENT_FILTER=""
TRACKER_PATH="reports/cass-effectiveness-2026-02-16.csv"
WORKSPACE="$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  tools/cass-preflight.sh --bead <bd-id> --query "<symptom or goal>" [options]

Required:
  --bead <id>         Bead/task id (example: bd-2jtf)
  --query "<text>"    Cass search query to run before implementation

Options:
  --days <n>          Search lookback window in days (default: 30)
  --limit <n>         Max cass results (default: 8)
  --fields <name>     Cass fields preset/list (default: summary)
  --agent <name>      Optional cass agent filter (codex, claude_code, ...)
  --workspace <path>  Workspace filter passed to cass (default: repo root)
  --tracker <path>    CSV tracker path relative to repo (default: reports/cass-effectiveness-2026-02-16.csv)
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bead)
      BEAD_ID="${2:-}"
      shift 2
      ;;
    --query)
      QUERY="${2:-}"
      shift 2
      ;;
    --days)
      DAYS="${2:-}"
      shift 2
      ;;
    --limit)
      LIMIT="${2:-}"
      shift 2
      ;;
    --fields)
      FIELDS="${2:-}"
      shift 2
      ;;
    --agent)
      AGENT_FILTER="${2:-}"
      shift 2
      ;;
    --workspace)
      WORKSPACE="${2:-}"
      shift 2
      ;;
    --tracker)
      TRACKER_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$BEAD_ID" || -z "$QUERY" ]]; then
  echo "Both --bead and --query are required." >&2
  usage >&2
  exit 2
fi

if ! command -v cass >/dev/null 2>&1; then
  echo "cass command not found in PATH." >&2
  exit 3
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SAFE_BEAD="$(printf "%s" "$BEAD_ID" | tr -c 'A-Za-z0-9._-' '_')"

mkdir -p "$ROOT_DIR/reports/cass"
mkdir -p "$ROOT_DIR/$(dirname "$TRACKER_PATH")"

ARTIFACT_REL="reports/cass/${TIMESTAMP}-${SAFE_BEAD}.json"
ARTIFACT_ABS="$ROOT_DIR/$ARTIFACT_REL"
TRACKER_ABS="$ROOT_DIR/$TRACKER_PATH"

CASS_CMD=(
  cass search "$QUERY"
  --robot
  --workspace "$WORKSPACE"
  --days "$DAYS"
  --limit "$LIMIT"
  --fields "$FIELDS"
)
if [[ -n "$AGENT_FILTER" ]]; then
  CASS_CMD+=(--agent "$AGENT_FILTER")
fi

"${CASS_CMD[@]}" > "$ARTIFACT_ABS"

node - "$ARTIFACT_ABS" "$TRACKER_ABS" "$BEAD_ID" "$QUERY" "$ARTIFACT_REL" <<'NODE'
const fs = require("fs");

const [artifactAbs, trackerAbs, beadId, query, artifactRel] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(artifactAbs, "utf8"));
const hits = Array.isArray(payload.hits) ? payload.hits : [];
const first = hits[0] ?? {};
const hitCount =
  typeof payload.total_matches === "number"
    ? payload.total_matches
    : typeof payload.count === "number"
      ? payload.count
      : hits.length;

const header = [
  "date_utc",
  "bead_id",
  "query",
  "hit_count",
  "reused_prior_art",
  "first_source_path",
  "first_line_number",
  "notes",
  "artifact_json"
];

if (!fs.existsSync(trackerAbs)) {
  fs.writeFileSync(trackerAbs, `${header.join(",")}\n`);
}

const esc = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
const row = [
  new Date().toISOString(),
  beadId,
  query,
  String(hitCount),
  "pending",
  first.source_path ?? "",
  first.line_number ?? "",
  "",
  artifactRel
];

fs.appendFileSync(trackerAbs, `${row.map(esc).join(",")}\n`);
console.log(
  `cass preflight logged: bead=${beadId} hits=${hitCount} tracker=${trackerAbs} artifact=${artifactRel}`
);
NODE

