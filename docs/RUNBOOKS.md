# Runbooks — Kosca Survey

Two-paragraph playbooks. Designed to be read at 2 AM.

> **Last restore drill:** _not yet performed — schedule one and update this date_

---

## App is down (browser can't reach https://…/login)

```sh
docker compose -f /home/koscait/survey/docker-compose.dev.yml ps
docker compose -f /home/koscait/survey/docker-compose.dev.yml logs --tail=100 app
curl -sv http://localhost:3002/api/health/ready
```

`live` returning 200 but `ready` returning 503 means the app process is up but **cannot reach the database**. Skip to the DB runbook below. If `ps` shows the container exited, the most recent crash will be in the last `logs` block; the top stack trace tells you what happened. Restart with `docker compose -f docker-compose.dev.yml restart app` and watch logs — if it loops, roll back the image: `git checkout <previous-tag> && docker compose up -d --force-recreate app`.

---

## Database unreachable / `ready` returns 503

```sh
docker ps | grep kosca_db
docker exec kosca_db pg_isready -U survey_app
docker exec kosca_db psql -U survey_app -d survey -c 'select 1'
```

If the DB container is down, restart from its own compose file (the survey app does **not** own the DB; it lives in the `kosca_ar_system` compose project). If `pg_isready` says yes but the app still can't connect, check that `DATABASE_URL` in `.env` matches what the DB expects (user, password, host=`kosca_db`, port=5432, dbname=`survey`). After a password rotation the app needs `docker compose restart app` to pick it up.

---

## Reminder emails not going out

```sh
docker compose -f docker-compose.dev.yml logs --tail=100 cron
docker compose -f docker-compose.dev.yml exec app curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-reminders
```

The cron container fires `POST /api/cron/daily-reminders` at **09:30 IST**. If the cron logs show no entries, `crond` may have died — restart the container. If the manual `curl` returns 401, the `CRON_SECRET` env in the cron container drifted from the app's; redeploy with consistent env. If `curl` returns 200 but no mail arrived, check the app logs for `mailer` lines — the most common cause is SMTP creds rotated. Inspect `.env` for `SMTP_*` and verify the upstream relay.

---

## Surveys link "expired" or 404

```sh
docker compose -f docker-compose.dev.yml exec app psql "$DATABASE_URL" \
  -c "select id, status, deadline from \"Campaign\" where id = '<id>'"
```

A campaign with `status = CLOSED` or with `deadline` in the past locks all its tokens. To temporarily re-open: `update "Campaign" set status='ACTIVE', deadline = now() + interval '7 days' where id = '<id>'`. If the token itself is invalid (404 on `/survey/<token>`), look up the assignment: `select id, submittedAt from "CampaignAssignment" where token = '<t>'` — already-submitted assignments return 410 by design, not a bug.

---

## Disk full on the survey host

```sh
df -h
docker system df
```

Most common offender: `survey_backups` volume after months of dumps. Adjust `BACKUP_RETENTION_DAYS` in `.env` and prune manually: `docker exec kosca_survey_backup find /backups -name 'survey-*.sql.gz' -mtime +14 -delete`. Second most common: Next dev `.next` cache — `docker compose down && docker volume rm survey_survey_dev_next && docker compose up -d`.

---

## Rate limit firing on legitimate traffic

A 429 from `/api/auth/...` usually means an HR user is mass-clicking through a campaign. Confirm via:

```sh
docker compose logs --tail=200 app | grep ' 429 '
```

If genuine abuse: nothing to do — the limiter is working. If a real user, bump the per-IP limit for that route in `proxy.ts` (`RATE_LIMITS` array) and redeploy. **Do not** disable the limiter to "fix" the alert — that turns one user complaint into a global outage vector.

---

## Rollback to previous deploy

```sh
cd /home/koscait/survey
git log --oneline -10                       # find the last good commit
git checkout <sha>                          # detach onto the good revision
docker compose -f docker-compose.dev.yml up -d --force-recreate app
curl -sf http://localhost:3002/api/health/ready    # confirm green
```

If a bad migration is part of the rollback, you also need to revert the schema. **Never** run a destructive `prisma migrate reset` against prod; instead restore from the latest backup (see `docs/BACKUP.md` → "Restore drill"), then redeploy the good commit. Document every prod rollback in this file under a dated bullet so the next one is faster.

## Load test (k6)

```sh
k6 run --vus 10 --duration 30s tests/loadtest/smoke.js
BASE_URL=https://your-host k6 run tests/loadtest/smoke.js
```

Smoke profile asserts: `/api/health/live` p95 < 200ms, `/api/health/ready` p95 < 500ms, `/login` p95 < 1.5s, error rate < 1%. Failure exits non-zero. Run weekly and after any infra change.

## Reference

- Health: `GET /api/health/live`, `GET /api/health/ready`
- Metrics: `GET /api/metrics` (Prometheus exposition)
- Audit log: `select * from "AuditLog" order by "createdAt" desc limit 50;`
- Backup script: `scripts/backup.sh` (see `docs/BACKUP.md`)
- Migration policy: `npx prisma migrate deploy` only — never `db push` against prod
