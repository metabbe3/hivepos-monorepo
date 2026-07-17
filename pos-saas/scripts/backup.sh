#!/usr/bin/env bash
#
# hivePOS Postgres backup.
#
# Dumps the docker-compose `db` service to ./data/backups and prunes dumps
# older than RETENTION_DAYS (default 7). Run from cron, e.g. hourly:
#
#   0 * * * *  /path/to/pos-saas/scripts/backup.sh >> /var/log/hivepos-backup.log 2>&1
#
# For offsite protection, sync ./data/backups to S3/rsync/B2 separately.
#
# Restore (to a running db container):
#   gunzip -c ./data/backups/pos_saas-<stamp>.sql.gz | \
#     docker compose exec -T db psql -U posadmin -d pos_saas
set -euo pipefail

cd "$(dirname "$0")/.."

RETENTION_DAYS="${RETENTION_DAYS:-7}"
OUT_DIR="./data/backups"
mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/pos_saas-$STAMP.sql.gz"

echo "[$(date -u +%FT%TZ)] backing up -> $FILE"
docker compose exec -T db pg_dump -U posadmin -d pos_saas | gzip > "$FILE"

# Prune older backups (mtime, days)
find "$OUT_DIR" -name 'pos_saas-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -u +%FT%TZ)] done (retention ${RETENTION_DAYS}d, kept $(ls -1 "$OUT_DIR"/pos_saas-*.sql.gz 2>/dev/null | wc -l | tr -d ' ') dumps)"
