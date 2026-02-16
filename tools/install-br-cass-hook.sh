#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER_SRC="$ROOT_DIR/tools/bin/br"
TARGET_BIN="${HOME}/.local/bin/br"
REAL_BIN="${HOME}/.local/bin/br.real"

if [[ ! -x "$WRAPPER_SRC" ]]; then
  echo "Wrapper script not executable: $WRAPPER_SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_BIN")"

if [[ -L "$TARGET_BIN" && "$(readlink "$TARGET_BIN")" == "$WRAPPER_SRC" && -x "$REAL_BIN" ]]; then
  echo "br cass hook already installed."
  exit 0
fi

if [[ ! -e "$REAL_BIN" ]]; then
  if [[ ! -e "$TARGET_BIN" ]]; then
    echo "No existing br binary found at $TARGET_BIN to back up." >&2
    exit 1
  fi
  mv "$TARGET_BIN" "$REAL_BIN"
  chmod +x "$REAL_BIN"
fi

ln -sf "$WRAPPER_SRC" "$TARGET_BIN"
chmod +x "$TARGET_BIN"

echo "Installed br cass hook:"
echo "  wrapper: $TARGET_BIN -> $WRAPPER_SRC"
echo "  real br: $REAL_BIN"
