#!/usr/bin/env bash
# =============================================================================
# Daily database backup — run via cron
# =============================================================================
# Add to crontab:
#   crontab -e
#   0 3 * * * /root/stusta-gym-app/deploy/production/backup.sh
# (scripts/deploy-to-vm.sh installs this file to that path)
# =============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/stusta-gym"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
DUMP_FILE="${BACKUP_DIR}/${TIMESTAMP}_full.dump"

mkdir -p "$BACKUP_DIR"

TMP_FILE="${DUMP_FILE}.partial"

fail() {
    echo "ERROR: $1" >&2
    logger -t stusta-gym-backup -p user.err "$1"
    rm -f "$TMP_FILE"
    exit 1
}

# Dump into a temp file first: a failed dump (database down, disk full, ...)
# must never leave an empty file behind that looks like a backup.
# (With set -e alone the script exited before the size check could run.)
docker exec supabase-db pg_dump \
    -U postgres \
    -Fc \
    --no-owner \
    -d postgres \
    > "$TMP_FILE" || fail "pg_dump failed"

[ -s "$TMP_FILE" ] || fail "backup file is empty"
mv "$TMP_FILE" "$DUMP_FILE"

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "Backup created: ${DUMP_FILE} (${SIZE})"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "*.dump" -mtime +${RETENTION_DAYS} -delete
echo "Cleaned up backups older than ${RETENTION_DAYS} days."
