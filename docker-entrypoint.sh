#!/usr/bin/env bash
set -e

echo "[entrypoint] waiting for database..."
ATTEMPTS=0
until pg_isready -h "${DB_HOST:-kosca_db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-survey_app}" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -gt 60 ]; then
    echo "[entrypoint] database not reachable after 60 attempts; giving up"
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] database is ready"

# Prisma 7 reads config from /app/prisma.config.ts (auto-detected when run from /app).
# Run from /app so the relative `prisma/schema.prisma` and config file resolve.
echo "[entrypoint] running prisma migrate deploy..."
( cd /app && NODE_PATH=/app/tools/node_modules node /app/tools/node_modules/prisma/build/index.js migrate deploy )

echo "[entrypoint] running seed..."
( cd /app && NODE_PATH=/app/tools/node_modules node /app/tools/node_modules/tsx/dist/cli.mjs /app/prisma/seed.ts ) || echo "[entrypoint] seed step finished (errors ignored if idempotent)"

echo "[entrypoint] starting app: $@"
exec "$@"
