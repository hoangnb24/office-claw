#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BR_BIN="${BR_BIN:-br}"
if [[ "${1:-}" == "--br-bin" ]]; then
  BR_BIN="${2:-}"
  shift 2
fi

if [[ $# -eq 0 ]]; then
  exec "$BR_BIN" update
fi

UPDATE_ARGS=("$@")

STATUS=""
BEAD_ID=""
EXPECT_VALUE=""

for ARG in "${UPDATE_ARGS[@]}"; do
  if [[ -n "$EXPECT_VALUE" ]]; then
    if [[ "$EXPECT_VALUE" == "status" ]]; then
      STATUS="$ARG"
    fi
    EXPECT_VALUE=""
    continue
  fi

  case "$ARG" in
    --status=*)
      STATUS="${ARG#--status=}"
      ;;
    --status)
      EXPECT_VALUE="status"
      ;;
    --db|--actor|--lock-timeout)
      EXPECT_VALUE="skip"
      ;;
    --*)
      ;;
    -*)
      ;;
    *)
      if [[ -z "$BEAD_ID" ]]; then
        BEAD_ID="$ARG"
      fi
      ;;
  esac
done

if [[ "$STATUS" == "in_progress" ]]; then
  if [[ -z "$BEAD_ID" ]]; then
    echo "[cass-hook] Could not determine issue id for br update preflight." >&2
    exit 64
  fi

  QUERY="${CASS_PREFLIGHT_QUERY:-}"
  if [[ -z "$QUERY" ]]; then
    ISSUE_JSON="$("$BR_BIN" show "$BEAD_ID" --json 2>/dev/null || true)"
    if [[ -n "$ISSUE_JSON" ]]; then
      QUERY="$(
        node -e '
          const fs = require("fs");
          const raw = fs.readFileSync(0, "utf8").trim();
          if (!raw) process.exit(0);
          const payload = JSON.parse(raw);
          const issue = Array.isArray(payload) ? payload[0] : payload;
          if (!issue || typeof issue !== "object") process.exit(0);
          const keys = ["title", "summary", "description", "acceptance_criteria"];
          const parts = [];
          for (const key of keys) {
            const value = issue[key];
            if (typeof value === "string" && value.trim()) {
              parts.push(value.trim());
            }
          }
          const query = parts.join(" | ").slice(0, 500);
          if (query) process.stdout.write(query);
        ' <<<"$ISSUE_JSON" 2>/dev/null || true
      )"
    fi
  fi
  if [[ -z "$QUERY" ]]; then
    QUERY="$BEAD_ID"
  fi

  PRE_ARGS=(
    --bead "$BEAD_ID"
    --query "$QUERY"
  )
  if [[ -n "${CASS_PREFLIGHT_DAYS:-}" ]]; then
    PRE_ARGS+=(--days "$CASS_PREFLIGHT_DAYS")
  fi
  if [[ -n "${CASS_PREFLIGHT_LIMIT:-}" ]]; then
    PRE_ARGS+=(--limit "$CASS_PREFLIGHT_LIMIT")
  fi
  if [[ -n "${CASS_PREFLIGHT_FIELDS:-}" ]]; then
    PRE_ARGS+=(--fields "$CASS_PREFLIGHT_FIELDS")
  fi
  if [[ -n "${CASS_PREFLIGHT_AGENT:-}" ]]; then
    PRE_ARGS+=(--agent "$CASS_PREFLIGHT_AGENT")
  fi
  if [[ -n "${CASS_PREFLIGHT_TRACKER:-}" ]]; then
    PRE_ARGS+=(--tracker "$CASS_PREFLIGHT_TRACKER")
  fi

  echo "[cass-hook] Running preflight for ${BEAD_ID} before claim..." >&2
  "$ROOT_DIR/tools/cass-preflight.sh" "${PRE_ARGS[@]}"
fi

exec "$BR_BIN" update "${UPDATE_ARGS[@]}"
