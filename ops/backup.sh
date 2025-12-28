#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/../backups"
mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M)
docker exec -t tempus_db pg_dump -U tempus -d tempus -Fc > "${OUT}/tempus_${STAMP}.dump"
# rotate: keep 7 daily, 4 weekly
ls -1t "${OUT}"/tempus_*.dump | awk 'NR>11{print}' | xargs -r rm -f
echo "Backup done: ${OUT}/tempus_${STAMP}.dump"