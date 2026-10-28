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
