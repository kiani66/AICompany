# Phase 4 — Vercel single-CEO deployment readiness

Status: **design/review only**. The existence of this document is NOT permission to deploy, provision paid services, merge code, migrate production data, or enable AI. Issue #9.

## Deployment topology
- Public HTTPS Next.js UI and stateless route handlers hosted on Vercel.
- Exactly one CEO login. No signups or public multi-user provisioning.
- Managed PostgreSQL, with a **separate non-owner runtime login** and a migration-only privileged login. Never expose either connection URL to the browser.
- Runtime state, sessions, rate limits, budget reservations and audit live in PostgreSQL. No memory-only correctness assumptions and no long-lived agent worker inside a Vercel function.
- No provider calls, outbound agent tools, cron inference jobs, paid provisioning or autonomous tasks in this phase.
- Phase 3B features reside in Draft PR #8 and are **not present on main**. If Phase 3B is merged later, apply its migrations and revisit least-privilege grants in a separate approved step.

## Pre-deployment gates (all mandatory)
1. **CEO authorization:** confirm Vercel account/team, intended hostname, environment (preview/production), budget and whether creating a managed database or paid resources is authorized.
2. **Ingress security:** determine trusted Vercel host, protocol and forwarded-header guarantees; reject spoofed/mismatched Host/Origin and insecure production POST flows. Verify cookie Secure/HttpOnly/SameSite and CSRF protections.
3. **Authentication resilience:** review login rate limit and lockout DoS behavior under distributed traffic and trusted forwarding. Test invalid and stale sessions, logout and throttling.
4. **Database separation:** use migration owner only in an operator-controlled migration operation; connect the app with non-owner credentials. Verify schema grants from `scripts/app-privileges.sql`, table/sequence permissions, restricted writes and lack of DDL/TRUNCATE powers.
5. **Database operations:** choose supported PostgreSQL provider and pooling; confirm connection count, transport TLS, backups, retention, restore rehearsal and region. Never run migrations automatically in `next build` or ordinary Vercel function invocations.
6. **Secrets:** configure `DATABASE_URL`, `SESSION_SECRET`, `CEO_PASSWORD_HASH` only in protected server environments. `DATABASE_MIGRATION_URL` should normally be supplied only to an approved migration job/operator, not the Vercel application. No `NEXT_PUBLIC_` prefix for secrets. Keep real-model credentials absent.
7. **Observability:** log sanitized operation identifiers and bounded error categories, not session cookies, prompts, credentials or SQL connection strings. Define alerting, audit retention and recovery.
8. **Durable jobs:** asynchronous work requires a persistently backed queue with leasing, atomic state transitions, idempotency, bounded retries, stale-lease recovery and kill-switch checks. This phase documents the design; no automatic background execution or paid inference.
9. **Release tests:** CI lint, typecheck, unit, disposable-Postgres integration, build and Playwright green at exact SHA. Independently exercise host/origin security and non-owner Postgres grants in a production-like pre-release environment.
10. **Final CEO sign-off:** project creation, paid resources, domain, database migration, preview/production deployments, GitHub merge and any inference activation each require explicit authorization.

## Proposed release sequence (not yet authorized)
1. Review hardening PR and its CI; keep main untouched until CEO-approved merge.
2. Approve and create a Vercel project linked to the approved repository/branch. Disable automatic production promotion until reviewed.
3. Provision a managed PostgreSQL database with backup/restore and a separate runtime login.
4. Run migrations and grants under approved operator credentials; verify the runtime user's least privileges.
5. Supply secrets in Vercel server-side environment settings; verify production URL/origin assumptions.
6. Approve a limited preview deployment, run authentication/authorization smoke tests and confirm real AI stays disabled.
7. After separate approval, promote production; monitor errors, DB connections and rate limits. Be prepared to roll back code and restore from DB backups (do not reverse committed schema blindly).

## Deferred / dependencies
- Phase 3B PR #8 must be separately reviewed and merged if its functionality is intended for the deployed version.
- Vercel plan, pricing, resource choices, actual Vercel project and DB provider are not yet selected or approved.
- OpenAI subscription-based inference for hosted/private AICompany is not presumed available; paid API billing is separate and disabled.
- Security gaps from earlier phases (login availability, trusted ingress, application DB role deployment, audit provenance and pagination) remain deployment blockers until addressed and tested.

## Implemented production ingress controls (Phase 4 PR #10)

`src/lib/origin.ts` requires an explicitly configured `APP_ORIGIN` for production and accepts only an absolute HTTPS origin without path/query/fragment. Request Host must exactly match; conflicting `x-forwarded-host` and non-HTTPS `x-forwarded-proto` are denied, never trusted to establish identity. Mutating requests require the exact Origin. Middleware rejects invalid ingress before login and health exceptions. Unit tests cover missing configuration, spoofed headers, protocol downgrades and local development.

**Preview caveat:** Vercel's dynamic preview domains are not automatically accepted. Set `APP_ORIGIN` for the exact, reviewed and stable preview hostname; uncontrolled preview URLs must fail closed. Verify Vercel's actual Host/TLS forwarding using an approved preview before production release. Do not blindly trust `VERCEL_URL` or arbitrary forwarded headers.

`.env.example` contains placeholders only. Keep migration-owner credentials out of the Vercel application. Production cookies are HttpOnly, Secure and SameSite=Strict; server-side session revocation remains required.

**Open blocker:** the account-wide rate limiter permits an attacker to temporarily lock out the CEO after ten attempts within fifteen minutes. Trusted-edge request/IP filtering and a recovery policy require separate review; do not trust arbitrary forwarding IP headers.

## Non-destructive runtime database preflight

After the migration owner runs reviewed migrations and `scripts/app-privileges.sql`, set `DATABASE_URL` to the actual **runtime** connection (NOT the migration owner) in an approved, secure operator environment and run:

```sh
npm run db:runtime-check
```

The command makes read-only PostgreSQL catalog queries. It fails when the connected role is a superuser, can create roles/databases/schema objects, bypasses row-level security, owns application tables, can truncate application tables, can update/delete audit history, or lacks audit read/insert privileges. It does not print the connection string or password.

This is a **necessary but insufficient** privilege check: it does not prove network/TLS configuration, role inheritance, all individual column grants, sequence ownership, migration history, or non-owner application operation. A controlled runtime login integration test and independent security review remain mandatory before deployment. Never run this preflight with production credentials in public CI logs.

## Phase 4 hardened login-source limiter (implemented, pending ingress verification)

The earlier single CEO-wide limit allowed a different remote attacker to consume the CEO's entire 15-minute login quota. In Vercel production the login route now derives a **per-source** bucket only when `NODE_ENV=production`, the platform-supplied `VERCEL=1`, the approved `APP_ORIGIN` check and the single valid `x-vercel-forwarded-for` IP are all present. The app stores an HMAC-SHA256 bucket digest under the server-only session secret; it never stores the source IP in `login_rate_limits`. Requests without verified origin/deployment configuration or a valid platform IP **fail closed (503)**. In local development, the original `ceo` bucket is retained to preserve tests and avoid trusting arbitrary caller-controlled headers.

Limits: ten login attempts per source per rolling 15-minute bucket, with atomic PostgreSQL UPSERT. This mitigates the *global* CEO login lockout: unrelated IPs cannot consume one shared account-wide bucket. **It does not prevent lockout by another user sharing the same NAT/VPN address**, distributed credential stuffing, or database table growth from rotating IPs. Do not treat per-IP buckets as sufficient brute-force protection.

### Required Vercel WAF operator gate (not configured or authorized yet)

Before permitting public internet traffic:
1. In the correct Vercel account/project, review the supported plan, WAF rate-limit availability and **pricing** with the CEO. Creating/publishing a firewall rule requires its own authorization.
2. Define a narrowly scoped rule for **POST /api/login** with IP (or IP+JA4) source rate limiting; begin with logging/challenge where supported, validate legitimate sign-in and then switch to a protective response on clear abuse. Avoid using client-controlled custom headers as the rate-limit key.
3. Inspect WAF logs and test requests from two independent addresses, malformed `x-vercel-forwarded-for`, credential stuffing, and recovery after expiry. Verify actual Vercel behavior for forwarded headers. Prefer Vercel Deployment Protection for Preview if available.
4. Set an alert and a **manual, audited** cleanup/retention policy for expired `login_rate_limits` rows. Never add a broad unauthenticated reset endpoint. If a source NAT becomes temporarily blocked, the CEO needs a documented out-of-band recovery route.
5. Re-evaluate account-based MFA before production exposure. The current single password is not equivalent to MFA.

Official references: https://vercel.com/docs/headers/request-headers and https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

## Phase 4 pooled Postgres connections (implemented, production verification required)

`src/db/client.ts` owns a shared warm-instance `postgres.js` client used by Drizzle, workflow and the fake runtime. Vercel instances limit this in-process pool to two connections (five in development), with five-second connection timeout and twenty-second idle timeout. This avoids opening three independent five-connection pools *within the same function instance*. It is **not a global concurrency cap**: each scaled-out instance can create its own connections. Production must use a managed transaction/connection pooler appropriate to the Postgres host, with monitored connection limits and TLS enforcement. Validate its transaction/advisory-lock support against Phase 3A before approving deployment; changing the driver or pooling mode could affect transaction locks.

`DATABASE_MIGRATION_URL` is forbidden in application production runtime. Migration owner credentials belong only in an explicitly approved out-of-band migration operation; the least-privilege preflight remains required. Vercel currently connects PostgreSQL through external Marketplace integrations rather than providing a new Vercel Postgres database itself.

Official references: https://vercel.com/kb/guide/connection-pooling-with-functions and https://vercel.com/docs/postgres
