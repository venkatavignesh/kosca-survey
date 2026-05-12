#!/bin/sh
# Automated restore drill — proves that the latest backup file actually loads
# into a fresh Postgres and that the row counts make sense.
#
# Run from the host (not from inside the kosca_survey container):
#   ./scripts/restore-drill.sh
#
# Exit code 0  = drill passed
# Exit code !=0 = drill FAILED — investigate before next backup cycle.
#
# Updates docs/RUNBOOKS.md with the latest pass date on success.

set -eu

BACKUP_VOLUME="${BACKUP_VOLUME:-survey_survey_backups}"
PG_IMAGE="${PG_IMAGE:-postgres:18-alpine}"
SCRATCH_NAME="${SCRATCH_NAME:-survey_restore_drill}"
RUNBOOK="${RUNBOOK:-docs/RUNBOOKS.md}"
EXPECT_MIN_ROWS="${EXPECT_MIN_ROWS:-1}"  # at least one Employee row

cleanup() { docker rm -f "$SCRATCH_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "[drill] $(date -u +%FT%TZ) starting"

# Pull the latest dump out of the backup volume.
LATEST=$(docker run --rm -v "$BACKUP_VOLUME:/b" alpine ls -t /b | head -1)
if [ -z "$LATEST" ]; then
  echo "[drill] FAIL: no backups in volume $BACKUP_VOLUME"; exit 2
fi
echo "[drill] using $LATEST"

docker run -d --name "$SCRATCH_NAME" \
  -e POSTGRES_PASSWORD=scratch \
  -e POSTGRES_DB=survey \
  "$PG_IMAGE" >/dev/null

# Wait for ready.
for i in $(seq 1 30); do
  if docker exec "$SCRATCH_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

# Copy and restore.
docker cp "$(docker run --rm -v "$BACKUP_VOLUME:/b" alpine cat /b/$LATEST 2>/dev/null || true)" /dev/null 2>/dev/null || true
# Actually stream the dump straight in.
docker run --rm -v "$BACKUP_VOLUME:/b" alpine cat "/b/$LATEST" \
  | gunzip -c \
  | docker exec -i "$SCRATCH_NAME" psql -U postgres -d survey >/dev/null

# Sanity-check counts.
EMP_COUNT=$(docker exec "$SCRATCH_NAME" psql -U postgres -d survey -tAc 'select count(*) from "Employee"')
if [ "$EMP_COUNT" -lt "$EXPECT_MIN_ROWS" ]; then
  echo "[drill] FAIL: Employee row count $EMP_COUNT < expected $EXPECT_MIN_ROWS"; exit 3
fi

echo "[drill] PASS: Employee=$EMP_COUNT"

# Stamp the date in the runbook so it's visible to anyone reading the doc.
TODAY=$(date -u +%Y-%m-%d)
if [ -f "$RUNBOOK" ]; then
  sed -i.bak -E "s|\*\*Last restore drill:\*\* _.*_|**Last restore drill:** ${TODAY} (PASS)|" "$RUNBOOK"
  rm -f "$RUNBOOK.bak"
fi

echo "[drill] done"
