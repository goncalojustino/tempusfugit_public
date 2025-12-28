#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/code-backup.sh path/to/file [more/paths ...]
# Copies each given path into backups/code/<YYYYMMDD-HHMMSS>/<relative-path>.bak
# Relative paths should be from repo root. Only backs up existing files.

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
DEST_BASE="${ROOT_DIR}/backups/code/${TS}"

backup_one() {
  local src="$1"
  # normalize path relative to repo root
  if [[ "$src" != /* ]]; then
    src="${ROOT_DIR}/$src"
  fi
  if [[ ! -f "$src" ]]; then
    echo "[skip] not a file: $src" >&2
    return 0
  fi
  local rel
  rel="${src#${ROOT_DIR}/}"
  local dest="${DEST_BASE}/${rel}.bak"
  mkdir -p "$(dirname "$dest")"
  cp -a "$src" "$dest"
  echo "[ok] backed up: $rel -> backups/code/${TS}/${rel}.bak"
}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <file> [more files...]" >&2
  exit 1
fi

for p in "$@"; do
  backup_one "$p"
done

