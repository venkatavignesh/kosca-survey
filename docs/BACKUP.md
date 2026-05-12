# Backup & restore — Kosca Survey

## What runs

- `kosca_survey_backup` container (defined in `docker-compose.dev.yml`).
- Runs `scripts/backup.sh` daily at **02:00 IST**.
- Dumps the survey database via `pg_dump --clean --if-exists`, gzips it, and writes to the `survey_backups` Docker volume → host path `/var/lib/docker/volumes/survey_survey_backups/_data/`.
- Retention: **30 days** (configurable via `BACKUP_RETENTION_DAYS`).

## Optional remote destinations

Set these in `.env` and the script will use them automatically:

| Var | Purpose |
|---|---|
| `BACKUP_LAN_TARGET` | `user@host:/path` for an on-LAN copy via `scp` |
| `BACKUP_S3_BUCKET` + standard `AWS_*` envs | Offsite copy to an S3-compatible bucket |

Backups are layered: LAN runs first, S3 only runs if the LAN step succeeded (so a torched LAN host can't silently take the offsite copy with it).

## Manual run

```sh
docker compose -f docker-compose.dev.yml exec backup /scripts/backup.sh
```

## Restore drill (do at least once per quarter)

1. Spin up a scratch Postgres container:
   ```sh
   docker run --rm -d --name pgscratch -e POSTGRES_PASSWORD=scratch -p 55432:5432 postgres:18-alpine
   ```
2. Copy the most recent dump out of the backup volume:
   ```sh
   docker cp kosca_survey_backup:/backups/$(docker exec kosca_survey_backup ls -t /backups | head -1) ./latest.sql.gz
   ```
3. Restore into the scratch DB:
   ```sh
   gunzip -c latest.sql.gz | docker exec -i pgscratch psql -U postgres -d postgres
   ```
4. Spot-check a few rows:
   ```sh
   docker exec pgscratch psql -U postgres -c 'select count(*) from "Employee"; select count(*) from "Response";'
   ```
5. Tear down: `docker rm -f pgscratch && rm latest.sql.gz`.

Document the date of every restore drill in `docs/RUNBOOKS.md` under "Last verified".

## If the backup container is unhealthy

```sh
docker logs --tail=100 kosca_survey_backup
```

Common causes:
- DATABASE_URL not reachable (network or password rotated)
- Disk full on the volume → prune older dumps first
- pg_dump version mismatch (alpine ships PG18 client; works against PG13+)
