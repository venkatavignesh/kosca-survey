# Kosca Survey

Self-hosted employee appraisal survey app. Next.js 15 + Postgres + Prisma + NextAuth, fully Dockerized.

## Roles

- **ADMIN** (`it@kosca.in` / `Kosca@124` on first boot) — manages employees, masters (Location/OfficeType/Department), questions, campaigns, sends emails, manages staff users.
- **HR** (`hr@kosca.in` / `Kosca@124` on first boot) — read-only: views employees, all campaigns, every response, exports CSV.
- Both seeded users are forced to change their password on first login.

## Coexistence

The app **reuses the existing `kosca_db` Postgres** (postgres:17-alpine on host port 5434, internal `kosca_db:5432`) on the docker network `kosca_ar_system_default`. It does **not** run its own database.

Host ports used:

- `3002` — survey app

Outgoing email goes through whatever SMTP is configured in `.env` (Zoho, Office 365, Gmail, internal relay — anything that speaks SMTP). Set `SMTP_HOST/PORT/USER/PASS/FROM/SECURE`.

## First-time setup

```sh
# 1. Bootstrap the survey database + role inside the existing kosca_db
docker exec -i kosca_db psql -U postgres <<'SQL'
CREATE ROLE survey_app LOGIN PASSWORD 'change-me-strong';
CREATE DATABASE survey OWNER survey_app;
SQL

# 2. Configure
cp .env.example .env
# Edit .env: set SURVEY_DB_PASSWORD, NEXTAUTH_SECRET, SMTP_*, APP_URL.

# 3. Build + launch
docker compose up -d --build
```

The app at `http://<office-ip>:3002`.

## Operations

- View logs: `docker compose logs -f app`
- Run a manual seed: `docker compose exec app node_modules/.bin/tsx prisma/seed.ts`
- Open Prisma Studio: `docker compose exec app node_modules/.bin/prisma studio` (port-forward 5555 if you need browser access)
- Stop: `docker compose down`

Survey data lives in the shared `kosca_db` volume. Backups should target the `survey` database in `kosca_db`.

## CSV import shape (for `/admin/employees` import)

```csv
empCode,name,email,designation,location,officeType,department
EMP001,Alice,alice@kosca.in,Sr. Accountant,Chennai,HO,Accounts
EMP002,Bob,bob@kosca.in,Sales Exec,Chennai,Branch (Warehouse),BDE / Sales
```

The importer matches `location` / `officeType` / `department` against the master tables (case-insensitive) and can auto-create missing entries (toggle in the upload dialog).

## Email templates

Variables available in `emailSubjectTemplate` / `emailBodyTemplate`:

- `{{name}}`, `{{empCode}}`, `{{designation}}`, `{{email}}`
- `{{title}}` — campaign title
- `{{deadline}}` — yyyy-mm-dd, empty if not set
- `{{url}}` — unique survey link
- `{{code}}` — 6-digit confirmation code
