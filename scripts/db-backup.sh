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

    # Offsite mirror (DR — the sidecar otherwise keeps backups only on one host). No-op
    # unless BACKUP_REMOTE (an rclone remote:path) is set AND rclone is installed.
    # Enable: set BACKUP_REMOTE + run `rclone config` in the sidecar/host. Best-effort —
    # a failed mirror never affects the local backup or the loop.
    if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
      if rclone copy "$FILE" "$BACKUP_REMOTE" 2>/dev/null; then
        echo "[backup] offsite mirror ok → ${BACKUP_REMOTE}"
      else
        echo "[backup] offsite mirror FAILED (local backup intact)"
      fi
    fi
  else
    echo "[backup] $(date -u +%FT%TZ) FAILED — leaving previous backups intact"
    rm -f "$FILE.tmp"
  fi

  sleep "$INTERVAL"
done
