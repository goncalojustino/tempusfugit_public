#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M)
BACKUP_ROOT=${BACKUP_ROOT:-/backups}
CODE_SRC=${CODE_SRC:-/src}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-tempus}
DB_NAME=${DB_NAME:-tempus}
CODE_RETENTION_DAYS=${CODE_RETENTION_DAYS:-14}
DB_RETENTION_DAYS=${DB_RETENTION_DAYS:-14}

mkdir -p "${BACKUP_ROOT}/code" "${BACKUP_ROOT}/db"

# Code snapshot
CODE_FILE="${BACKUP_ROOT}/code/tempus_code_${STAMP}.zip"
(
  cd "${CODE_SRC}" || exit 1
  zip -r "${CODE_FILE}" . -x './backups/*' -x './.git/*' -x './node_modules/*'
)

echo "[${STAMP}] Code backup written to ${CODE_FILE}"

# Database dump
DB_FILE="${BACKUP_ROOT}/db/tempus_db_${STAMP}.dump"
if [ -z "${PGPASSWORD:-}" ]; then
  echo "PGPASSWORD is required" >&2
  exit 1
fi
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${DB_FILE}"
echo "[${STAMP}] Database backup written to ${DB_FILE}"

# Retention cleanup
find "${BACKUP_ROOT}/code" -type f -name 'tempus_code_*.zip' -mtime +"${CODE_RETENTION_DAYS}" -print -delete || true
find "${BACKUP_ROOT}/db" -type f -name 'tempus_db_*.dump' -mtime +"${DB_RETENTION_DAYS}" -print -delete || true
