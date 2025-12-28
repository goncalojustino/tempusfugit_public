#!/usr/bin/env bash
set -euo pipefail
FILE="${1:-}"
[ -f "$FILE" ] || { echo "Usage: $0 /path/to/backup.dump"; exit 1; }
docker cp "$FILE" tempus_db:/restore.dump
docker exec -it tempus_db pg_restore -U tempus -d tempus --clean --if-exists /restore.dump
echo "Restore complete."