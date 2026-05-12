#!/bin/sh
# Daily Postgres backup for the survey database.
#
# Run from the kosca_survey container (or any host with pg_dump + DATABASE_URL).
# Writes a timestamped, gzipped pg_dump into /backups and prunes anything older
# than $BACKUP_RETENTION_DAYS (default 30).
#
# Three destinations to layer (track 7 of the hardening playbook):
#   1. local      → /backups (mounted volume)
#   2. on-LAN     → SCP/rsync to a different host (set BACKUP_LAN_TARGET)
#   3. offsite    → S3-compatible (set BACKUP_S3_BUCKET + AWS_* envs; runs only
#                    after the LAN step succeeds so a torched LAN doesn't take
#                    the offsite with it).
#
# Exits non-zero on any failure so the cron driver can surface alerts.

set -eu

OUT_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/survey-$TS.sql.gz"

mkdir -p "$OUT_DIR"

echo "[backup] $(date -u +%FT%TZ) starting pg_dump"
pg_dump --no-owner --no-privileges --clean --if-exists "$DATABASE_URL" \
  | gzip -9 > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"

BYTES=$(stat -c '%s' "$FILE" 2>/dev/null || stat -f '%z' "$FILE")
echo "[backup] wrote $FILE ($BYTES bytes)"

# Retention prune
find "$OUT_DIR" -name 'survey-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete

# Optional LAN copy
if [ -n "${BACKUP_LAN_TARGET:-}" ]; then
  echo "[backup] copying to LAN target $BACKUP_LAN_TARGET"
  scp -o StrictHostKeyChecking=accept-new "$FILE" "$BACKUP_LAN_TARGET/" \
    || { echo "[backup] LAN copy FAILED"; exit 2; }
fi

# Optional offsite copy (only after LAN succeeded or was skipped)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "[backup] uploading to s3://$BACKUP_S3_BUCKET/"
  aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/$(basename "$FILE")" \
    || { echo "[backup] S3 upload FAILED"; exit 3; }
fi

echo "[backup] done"
