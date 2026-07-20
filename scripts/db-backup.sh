#!/bin/sh
# hivePOS Postgres auto-backup. Runs as the db-backup sidecar container.
# Dumps pos_saas every BACKUP_INTERVAL_SECONDS (default 12h) to /backups
# (host-mounted ./backups), gzipped plain SQL, with age-based retention.
#
# Restore (one host command):
#   gunzip -c ./backups/pos_saas_<ts>.sql.gz | \
#     docker exec -i hivepos-postgres-1 psql -U posadmin -d pos_saas
# (Drop/recreate the DB first if restoring over changed schema.)
set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-43200}"   # 12h
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
DB="${PGDATABASE:-pos_saas}"

mkdir -p /backups

echo "[backup] start — db=$DB interval=${INTERVAL}s retain=${RETAIN_DAYS}d"

while :; do
  TS=$(date -u +%Y%m%d_%H%M%S)
  FILE="/backups/pos_saas_${TS}.sql.gz"

  # Dump to a .tmp then atomically rename — a partial/interrupted run never
  # leaves a half-written .gz that looks like a valid backup.
  if pg_dump --no-password --no-owner "$DB" | gzip > "$FILE.tmp"; then
    mv "$FILE.tmp" "$FILE"
    SIZE=$(du -h "$FILE" | cut -f1)
    echo "[backup] $(date -u +%FT%TZ) ok → pos_saas_${TS}.sql.gz ($SIZE)"

    # Retention: prune dumps older than RETAIN_DAYS. Best-effort.
    find /backups -name 'pos_saas_*.sql.gz' -type f -mtime "+$RETAIN_DAYS" -delete 2>/dev/null || true
  else
    echo "[backup] $(date -u +%FT%TZ) FAILED — leaving previous backups intact"
    rm -f "$FILE.tmp"
  fi

  sleep "$INTERVAL"
done
