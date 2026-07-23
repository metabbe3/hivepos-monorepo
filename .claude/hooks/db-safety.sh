#!/usr/bin/env bash
# hivePOS DB-safety guard — Claude Code PreToolUse (Bash) hook.
#
# Before ANY command that can destroy pos_saas data, take a timestamped pg_dump
# to ./backups and only then allow it. Block (exit 2) if the backup fails or
# postgres is unreachable — a destructive op never runs without a fresh backup.
# Complements scripts/db-backup.sh (12h scheduled dumps); reuses its dump shape.
#
# Scope: inspects the Bash command STRING only — catches shell-level destructive
# ops (DROP/TRUNCATE/DELETE, prisma reset, docker compose down -v, volume rm,
# pg_restore --clean). Cannot see SQL run inside the app or app-driven migrations.
#
# stdin: {"tool_name":"Bash","tool_input":{"command":"..."}}.
# exit 0 = allow (after backing up, or if non-destructive). exit 2 = block.

set -uo pipefail

PG_CONTAINER="${HIVEPOS_PG_CONTAINER:-hivepos-postgres-1}"
BACKUP_DIR="${HIVEPOS_BACKUP_DIR:-./backups}"

# --- extract the command (fail open if jq/JSON is missing: don't brick the session) ---
CMD="$(jq -r '.tool_input.command // ""' 2>/dev/null)" || exit 0
[ -z "$CMD" ] && exit 0

# --- destructive-DB detection (case-insensitive). Over-matching → an extra
# gzipped backup, which is the safe failure mode; under-matching → data loss. ---
destructive=0
if printf '%s' "$CMD" | grep -qiE \
  'truncate'\
'|drop[[:space:]]+(table|database|schema|index|view|materialized)'\
'|delete[[:space:]]+from'\
'|prisma[[:space:]]+migrate[[:space:]]+reset'\
'|--force-reset'\
'|pg_restore([[:space:]]|.)+--clean'\
'|volume[[:space:]]+rm([[:space:]]|.)+(pgdata|hivepos)'; then
  destructive=1
fi
# docker (compose) down -v / --volumes — needs `down` (word-bounded, so not
# "shutdown") AND a standalone -v / --volumes token. Plain `docker compose down`
# keeps the named volume, so it is intentionally NOT matched.
if printf '%s' "$CMD" | grep -qiE '\bdown\b' && printf '%s' "$CMD" | grep -qiE '(^|[[:space:]])-v([[:space:]]|$)|(^|[[:space:]])--volumes([[:space:]]|$)'; then
  destructive=1
fi

[ "$destructive" -eq 0 ] && exit 0

# --- destructive: back up first ---
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/pre-change_${TS}.sql.gz"

# pg_dump from the postgres container → host gzip. PIPESTATUS[0] catches a
# failed/unreachable pg_dump even though gzip may succeed on empty input.
if docker exec "$PG_CONTAINER" pg_dump -U posadmin --no-owner pos_saas 2>/dev/null | gzip > "$OUT.tmp"; then
  rc="${PIPESTATUS[0]}"
  if [ "$rc" -eq 0 ] && [ -s "$OUT.tmp" ] && gzip -t "$OUT.tmp" 2>/dev/null; then
    mv "$OUT.tmp" "$OUT"
    # Best-effort retention: prune pre-change backups older than 14 days.
    find "$BACKUP_DIR" -name 'pre-change_*.sql.gz' -type f -mtime +14 -delete 2>/dev/null || true
    echo "DB-SAFETY: destructive DB command detected → backed up pos_saas to $OUT; proceeding." >&2
    exit 0
  fi
fi

rm -f "$OUT.tmp"
cat >&2 <<EOF
DB-SAFETY: backup FAILED — BLOCKING the destructive command.
Could not dump pos_saas from container '$PG_CONTAINER' (postgres down? wrong
container? pg_dump error?). Either start the stack (docker compose up -d) and
retry, or take a manual backup first:
  docker exec $PG_CONTAINER pg_dump -U posadmin --no-owner pos_saas | gzip > ./backups/manual_<ts>.sql.gz
EOF
exit 2
