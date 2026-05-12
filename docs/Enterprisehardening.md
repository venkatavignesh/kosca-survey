# Enterprise Hardening Playbook — Kosca Apps

**Status:** v1
**Scope:** Stack-agnostic engineering playbook for taking any Kosca office app from "working" to "production-grade". Use alongside an app-specific implementation log (see `docs/enterprise-hardening-plan.md` for how the KOSCA AR system applied this playbook).

The original plan was tightly coupled to the AR system (Express 5 + Prisma + EJS + BullMQ + Redis). This document strips those specifics out: each track names the *capability* the app must have, not the library that delivers it. Translate to whatever stack you're using (Node/Python/Go/Java; SQL/NoSQL; REST/HTMX/SPA — the requirements don't change).

---

## Maturity tiers

Score each track 1–10. An app is **production-grade** when every track is ≥ 8.

| Tier | Score | Meaning |
|---|---|---|
| Prototype | 1–4 | Works on the developer's machine. One crash = data loss. |
| Workable | 5–7 | Runs in production but has gaps that bite during incidents. |
| **Production-grade** | **8–9** | **Survives outages, scales linearly, can be picked up by a new engineer in a day.** |
| Enterprise | 10 | Plus SLAs, formal audits, compliance certifications. |

The bar this playbook targets: **production-grade**.

---

## The eight tracks

A Kosca app is hardened along eight independent tracks. They can be advanced in parallel; the dependency graph at the bottom shows what unblocks what.

1. **Stability** — won't crash; recovers cleanly.
2. **Input safety** — every external value is validated.
3. **Performance** — scales with data, not just users.
4. **Code organisation** — a stranger can navigate it.
5. **Testing** — confidence to refactor.
6. **Monitoring** — you know it's broken before users do.
7. **Operations** — deployable, recoverable, auditable.
8. **Supply-chain** — dependencies are tracked and current.

Each track has a **definition of done** and **anti-patterns to avoid**. The point is not to follow this as a recipe; it's to make sure none of the eight is silently at 3/10 when the rest are at 9.

---

## Track 1 — Stability

**Goal:** A crash kills the request, not the process. A SIGTERM drains in-flight work before exiting.

**Definition of done:**

- Top-level handlers for unhandled rejection / uncaught exception that log structured context and decide whether to exit. Async errors propagate to the framework's error middleware, not to a silent `console.error`.
- A single global error formatter that maps known error classes (validation, not-found, conflict, auth) to status codes + safe payloads. **No stack traces in production responses.**
- Per-request correlation IDs propagated through every log line and returned to the client (`X-Request-ID`). Honour an upstream ID if present.
- Content-negotiating error response: HTML for browsers, JSON for API clients, framework-native partials for inline-swap clients (HTMX / Turbo / htmz).
- Graceful shutdown closes DB connections, message-queue connections, cache clients, and in-flight HTTP handlers in parallel with a timeout; logs what closed and what timed out.
- Background workers carry the same handlers and graceful-shutdown contract as the web tier.

**Anti-patterns:**

- A bare `try/catch` that swallows the error and returns `200 OK` with empty data.
- Leaking ORM error messages to clients ("relation 'users' does not exist" should never reach a UI).
- `process.on('uncaughtException')` that logs and continues — the process is in undefined state. Log and exit; the supervisor restarts.
- A graceful-shutdown that waits forever for in-flight requests with no timeout. Cap it.

---

## Track 2 — Input safety

**Goal:** Every value crossing the trust boundary is validated against a schema. Failures return 400 with a useful message, not 500.

**Definition of done:**

- A single validation library used everywhere (Zod / Joi / Pydantic / class-validator — pick one).
- POST / PUT / PATCH bodies validated. Common-sense limits enforced (max field length, max array size).
- **Query strings and route params validated too** — not just bodies. Pagination, date filters, IDs, status enums.
- File upload validation: type, size, and (for spreadsheets/CSV) row count + column shape — *before* heavy parsing.
- General rate limiter at the framework boundary (e.g. 120 req/min per session or IP). Health-check paths skipped. Stricter limiter on auth endpoints.
- CSRF protection on all state-changing requests. SameSite-strict cookies where possible.
- Security headers via a single middleware (Helmet / equivalent). At minimum: HSTS, X-Frame-Options, Content-Security-Policy.
- Auth boundary enforced by middleware, not by hand in each handler. Three permission layers minimum: role, feature-permission, and data-scope (e.g. site / tenant / customer-set).

**Anti-patterns:**

- Validating body but trusting query params.
- "Optional" fields that the handler reads without `??` defaults — silent NaN/undefined propagation.
- Date inputs parsed with `new Date(string)` and no validity check (`Invalid Date` propagates).
- Permission check inline in the handler ("`if (req.user.role === 'admin')`") instead of declarative middleware.
- Mounting a rate limiter that includes `/health` — your load balancer's probe rate kills the app.

---

## Track 3 — Performance

**Goal:** Latency budget known. Queries bounded. N+1 eliminated. Cache the right things.

**Definition of done:**

- Latency SLOs published: `p95 < 1.5s`, `p99 < 3s`, error rate `< 1%`. Enforced via load test (see Track 7).
- No unbounded `findMany` / `SELECT *` over the entire table. Replace with paginated aggregates: "give me a page of grouped keys, then fetch detail only for that page".
- Hot list pages use `GROUP BY` to compute counts and totals in the database, not in memory.
- Bulk operations run in transactions. Worker batches sized so a single transaction stays under a few seconds.
- N+1 fixed at the source: either with eager-fetch (`include` / `joins`) or by collecting keys and issuing one `WHERE id IN (...)` per relation.
- Dashboards and other repeat-render aggregates cached with a key that includes the input filters. Invalidated on the events that change the underlying data (uploads, manual edits, scheduled syncs).
- Composite indexes added for hot query shapes. Look at `EXPLAIN` for the top 10 queries before signing off. Index on the *combination* of filter columns the query actually uses, not one column per index.
- Large-file ingestion uses streaming, not full read into memory. Spreadsheets, CSVs, JSON arrays all stream row-by-row.

**Anti-patterns:**

- "We'll optimise later." Later is now.
- An index per column that's ever queried. Composite indexes matter more.
- Caching everything with a 5-minute TTL "to be safe". Invalidate on write or don't cache.
- Generating reports in a request handler. Move long-running work to a job queue.
- Loading 100k rows into memory to count them. The DB can count.

---

## Track 4 — Code organisation

**Goal:** A new engineer can find anything in five clicks. No file exceeds ~500 lines without a strong reason. Business logic lives outside the framework adapter.

**Definition of done:**

- **Service layer** between HTTP handlers and data access. Handlers do request parsing + response shaping; services do the work; data-access (ORM / SQL builder) is called only from services.
- Cross-cutting concerns (date formatting, HTML escaping, pagination parsing) extracted to a `utils/` module. Single source of truth for each.
- File-size discipline: route files cap around 300–500 lines. When they exceed, split by feature or by HTTP verb cluster. Services cap around 600 lines; split by aggregate root.
- Shared upload / auth / rate-limit / error-formatter middleware lives in `middleware/` (or your stack's equivalent), wired centrally at app start.
- Background-job glue (queue connections, scheduler) lives in its own module so the web tier can also enqueue jobs without importing the worker.
- Templates / views are framework-idiomatic. Avoid the "build HTML in a JS string in the controller" anti-pattern — use partials / components / fragments.
- Named constants for action codes, status enums, permission keys. Strings appear once.

**Anti-patterns:**

- A 1,500-line route file. It will hide a bug for years.
- Direct ORM calls in HTTP handlers. The handler is now both presentation and business logic; testing it requires a full HTTP stack.
- `const ACTION = 'CO_ASSIGNED'` repeated in 17 files. One typo and audit logging breaks silently.
- Inline HTML in handlers ("`return res.send('<div>...')`"). Unmaintainable; security-prone.
- Layout pages that build the body via template literals passed to a layout partial. Use composition (header / body / footer includes), not interpolation.

---

## Track 5 — Testing

**Goal:** A green build means safe to deploy. Tests run in CI on every PR. Coverage thresholds *only ratchet up*.

**Definition of done:**

- Unit tests for every service module. Aim for ≥ 70% statement, ≥ 70% branch, ≥ 70% function, ≥ 70% line coverage at the service layer specifically. Services are pure-ish; this is the cheapest place to get coverage.
- Integration / route tests for every HTTP endpoint that mutates state, plus one happy-path read per resource. Use a real DB in a test container, not heavy mocks.
- Tests assert outcomes, not implementations. Don't assert which ORM method was called.
- Coverage thresholds wired into the test runner (`jest.config` / `pyproject.toml` / `go.mod`-test-tag). **Floors only ratchet up, never down.** Bump the floor every time new tests land.
- E2E / browser test is optional. If included, keep it focused on golden-path flows (login, upload, primary report). Smoke-only, not exhaustive.
- Critical bug fixes ship with a regression test that fails before the fix. No exceptions.

**Anti-patterns:**

- Mocking the database so heavily that the test passes but the production migration breaks. Integration tests must hit a real DB.
- A 95%-coverage suite where every test is `expect(true).toBe(true)`. Coverage is a floor, not a target.
- "We'll write tests after the refactor." You will not.
- Skipping (`.skip` / `xfail`) a flaky test without a date-stamped "remove after" condition.

---

## Track 6 — Monitoring

**Goal:** You discover incidents from your dashboard, not from a customer.

**Definition of done:**

- Three liveness/readiness endpoints: `/live` (process alive), `/ready` (DB + cache + queue reachable), `/health` (legacy aggregate, often the same as `/ready`).
- Prometheus-compatible `/metrics` endpoint emitting: HTTP request count + duration histograms (labels: route, method, status), HTTP error count (labels: status, kind), worker-job success/failure counters (labels: queue, kind), Node-runtime / GC defaults.
- Structured logging (`pino` / `bunyan` / Python `structlog` / equivalent). Every line carries: `timestamp`, `level`, `requestId`, `userId` (when known), `route`, `latency`. Logs as JSON, not pretty-printed in prod.
- Audit log table for state-changing admin actions and auth events. Append-only. Action codes are named constants (Track 4). Indexed on `(userId, createdAt)`, `(action, createdAt)`, and `(entityType, entityId, createdAt)`.
- Alert routes from `/metrics` to a person on-call. Even just a Slack webhook on `error_rate > 1%` is enough to start; refine later.
- (Optional / soon) Grafana dashboard with one panel per SLO and one panel per major resource (DB, cache, queue depth).

**Anti-patterns:**

- Logs go to stdout and are never collected. The first incident teaches you why.
- An audit table with `action: TEXT` and no index on it. Every admin query becomes a sequential scan.
- 17 different log formats across files. Pick one logger and use it everywhere, including workers.
- Prometheus metrics that don't include error counters. You'll see a fall in request rate and not know if it's a quiet day or an outage.

---

## Track 7 — Operations

**Goal:** Anyone on the team can deploy, recover, and rotate secrets in under 30 minutes.

**Definition of done:**

- A single deploy script. Idempotent. Runs migrations as part of startup. Health-checks before swapping traffic.
- Schema migrations are versioned files checked into the repo. **Never `prisma db push` / `manage.py migrate --fake` / equivalent.** Every change goes through a migration file applied via `migrate deploy`.
- Three backup destinations: local snapshot, on-LAN (different host), offsite (S3-compatible). Layered, with the offsite running *after* the LAN succeeds so a torched LAN doesn't silently take the offsite with it. Per-host prefixing if multi-source. Verified restore drill done at least once.
- Load-test baseline checked into the repo. Failing the SLO targets (Track 3) is a build break. Stress + smoke profiles documented separately.
- Secrets in environment variables, never in code or in committed config. A `.env.example` documents every variable the app reads. A startup check refuses to boot if a required secret is missing.
- CI pipeline on every PR: lint, format, test with coverage gate, audit/SCA. Build-image step gated on CI green.
- Rollback procedure documented and tested. A single command (or a single button) reverts to the previous good build.
- Runbook for the top five incident classes (DB down, queue backed up, OOM kill, disk full, cert expiring). Two-paragraph max per incident; written for someone who is half asleep.

**Anti-patterns:**

- A deploy script that requires manual steps "just for production". Manual steps are how prod and staging drift apart.
- Secrets in `.env` committed to git. Even private repos. Even just once.
- Backup script that hasn't been tested by restoring from it. You don't have a backup; you have a hope.
- A migration applied by hand and only retroactively committed. Now staging and prod schemas diverge invisibly.

---

## Track 8 — Supply-chain

**Goal:** No critical CVEs sitting in the dependency tree. Updates land in batches, reviewed, with tests passing.

**Definition of done:**

- Dependabot / Renovate / equivalent configured for every package ecosystem the repo uses (npm, pip, gomod, GitHub Actions, Docker base images). Weekly schedule. Minor/patch batched into one PR per ecosystem; major upgrades stay individual.
- CI runs `npm audit` / `pip-audit` / `govulncheck` / `trivy` on every PR. **Critical-level findings fail the build.** High is advisory (Dependabot will catch up; manual fix only if it can't).
- Direct CVE remediation via package-manager overrides (`pnpm.overrides`, `package.json#resolutions`, `go mod edit -replace`) when a vulnerable package is pulled in transitively and there's no clean update.
- Pin versions of the most security-sensitive dependencies (ORM migration engine, auth library, crypto primitives). Surprise updates to these warrant a manual review, not an auto-merge.
- Lock files (`pnpm-lock.yaml` / `package-lock.json` / `poetry.lock` / `go.sum`) committed and respected by CI. CI never installs without `--frozen-lockfile`.
- Base container images pinned to a specific digest, not `:latest`. Renovate updates the digest; you re-run the build.

**Anti-patterns:**

- Auto-merging Dependabot PRs without CI passing. You will ship a regression.
- Ignoring "high" advisories because they're "test-tooling only". Verify the dependency tree; sometimes those leak into runtime.
- Pinning everything to exact versions and never bumping. Now you're a year behind and the cumulative upgrade is terrifying.

---

## Adoption — how to apply this to a new Kosca app

Order matters in early-stage apps. The list below is the sequence I'd recommend a brand-new Kosca app follow from week 1.

1. **Week 0 — bootstrap.** Repo, CI skeleton (lint + test + audit), `.env.example`, deploy script that just builds + runs the test suite. Health endpoint returns `{ status: 'alive' }`. That's the minimum viable hardening foundation.
2. **Stability + Input safety (Tracks 1 + 2).** Get to 8/10 before adding the second feature. They're a pain to retrofit and cheap to start with.
3. **Service layer (Track 4) before the second route.** The first route is "just" CRUD; by the third one you'll regret not having a service layer.
4. **Monitoring (Track 6) before the first prod deploy.** `/live`, `/ready`, `/metrics`, structured logs. Without these you're flying blind.
5. **Backups (Track 7) before the first row of customer data.** Off-machine, off-site, tested restore. Non-negotiable.
6. **Testing (Track 5) ratcheted from day 1.** Start with a coverage floor of 0 and ratchet up with every PR. Refuse to merge anything that lowers the floor.
7. **Performance (Track 3) when the first slow query shows up.** Don't over-index speculatively — let real queries drive the indexes.
8. **Operations + Supply-chain (Tracks 7, 8) as the team grows past one engineer.** Documentation matters most when there's more than one person who needs it.

### Per-app implementation log

Each Kosca app keeps its own implementation log next to this playbook — see [`docs/enterprise-hardening-plan.md`](enterprise-hardening-plan.md) (KOSCA AR) for the canonical example. The log captures:

- Which track is at what score, with file references.
- Per-phase shipped items + dates.
- Open items + risk assessment.
- Per-track decisions and trade-offs (e.g. "we deferred TypeScript migration").

The playbook is the **what + why**. The implementation log is the **what we did + when**.

---

## Common language

A few terms used consistently across Kosca apps so engineers moving between them aren't relearning vocabulary.

| Term | Meaning |
|---|---|
| **Trust boundary** | The line between code we wrote and input we received. Validation happens here. |
| **Request ID** | The UUID propagated through every log line for one request. Returned as `X-Request-ID`. |
| **Service layer** | Code between HTTP handlers and data access. The unit-test target. |
| **Cache key** | A composite identifier that includes all inputs that change the result. Wrong cache key = stale data bug. |
| **SLO** | A target you actually enforce, not an aspiration. p95/p99/error-rate, gated in CI / load test. |
| **Audit log** | Append-only table of state-changing actions. Indexed for the three dimensions: who, what, target. |
| **Soft delete** | Marking a row inactive rather than deleting it. Default behaviour for any record referenced by historical data. (See: the KOSCA AR `CustomerAssignment` deletion bug — fully-cleared customers lost their CO assignment, breaking per-CO historical reports.) |
| **Hard delete** | Physical removal. Only for genuinely orphan data with no audit/historical implications. |
| **Ratchet** | A floor that only goes up. Used for coverage thresholds. |
| **Runbook** | Two-paragraph incident playbook. Written so a tired engineer can follow it. |

---

## Reasonable defaults (start here, justify deviations)

| Setting | Default | Why |
|---|---|---|
| Latency SLOs | p95 < 1.5s, p99 < 3s, error rate < 1% | Achievable for OLTP web apps; tight enough to catch regressions |
| Rate limit | 120 req/min per user/IP, 10 req/min on auth | Stops abusive bursts without blocking real users |
| Coverage floor (start) | 30% line, 25% function, 18% branch | Achievable in week 1; ratchets up from there |
| Coverage target | 70/70/70/70 | The point at which the suite is genuinely protective |
| Session TTL | 24h sliding | Short enough to limit damage, long enough that users don't notice |
| Backup retention | 30 days local, 90 days offsite | Recovery from "I deleted it last week" + regulatory window |
| Worker batch size | 50 rows / transaction | Small enough to keep transactions short, large enough to amortise overhead |
| Log retention (hot) | 14 days | Enough for incident postmortems; cold archive beyond that |
| Migration policy | Versioned files, applied via `migrate deploy` on startup | Reproducible across environments |
| Secret store | Environment variables (12-factor); secrets manager for prod if available | Simple, well-understood, supports rotation |

---

## What's deliberately out of scope

- **Specific frameworks.** Express, Django, Spring, Fastify — playbook applies to all. Pick the one your team knows.
- **Language migrations.** TypeScript / mypy / strict-mode adoption is a separate multi-week project per app.
- **Compliance certifications** (SOC 2, ISO 27001, HIPAA). Reach production-grade first; certifications layer on top.
- **Multi-region / multi-tenant infrastructure.** Different problem class. Hit single-region production-grade first.
- **AI/ML in the request path.** Out of scope for the hardening playbook; treat ML services as upstream dependencies that need their own SLOs.

---

## Companion documents

- [`docs/enterprise-hardening-plan.md`](enterprise-hardening-plan.md) — KOSCA AR system implementation log (the original). Use as a worked example.
- [`docs/DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) — portable design language (UI tokens, components, motion). Pair this playbook with the design system when bringing up a new app.
- [`docs/DESIGN-LAW.md`](DESIGN-LAW.md) — KOSCA AR–specific design law. Each app should keep an equivalent.
