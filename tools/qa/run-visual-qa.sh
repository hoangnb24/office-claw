#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="online"
VALIDATE="0"

usage() {
  cat <<'EOF'
Usage: tools/qa/run-visual-qa.sh [--mode online|offline|both] [--validate]

Purpose:
  Launch deterministic visual QA scenarios for hitboxes/camera/highlights.

Options:
  --mode      online  -> client + world-server flow
              offline -> client-only flow (no websocket auto-connect)
              both    -> print both launch recipes
  --validate  run typecheck + build for apps/client-web before QA start
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --validate)
      VALIDATE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "online" && "$MODE" != "offline" && "$MODE" != "both" ]]; then
  echo "Invalid --mode '$MODE' (expected online|offline|both)" >&2
  exit 1
fi

if [[ "$VALIDATE" == "1" ]]; then
  echo "[qa] Running client validation..."
  npm --prefix "$ROOT_DIR/apps/client-web" run typecheck
  npm --prefix "$ROOT_DIR/apps/client-web" run build
fi

echo
echo "[qa] Visual checklist: docs/visual-qa-checklist.md"
echo "[qa] Capture findings with scenario ids (VQA-01..VQA-06)."
echo

if [[ "$MODE" == "online" || "$MODE" == "both" ]]; then
  cat <<'EOF'
[qa] ONLINE scenario launch
  Terminal A:
    npm --prefix apps/server-world run dev
  Terminal B:
    npm --prefix apps/client-web run dev
EOF
fi

if [[ "$MODE" == "offline" || "$MODE" == "both" ]]; then
  cat <<'EOF'
[qa] OFFLINE scenario launch
  Terminal:
    VITE_WORLD_WS_AUTO_CONNECT=0 npm --prefix apps/client-web run dev
EOF
fi

echo
cat <<'EOF'
[qa] Deterministic scenario order
  1) VQA-01 Hitbox target resolution
  2) VQA-02 Camera focus framing + panel anchoring
  3) VQA-03 Highlight lifecycle reset behavior
  4) VQA-04 Event feed -> focus/inspector linkage
  5) VQA-05 Navigation interaction + overlay diagnostics
  6) VQA-06 Agent inspector live state/task/blocker rendering
EOF
