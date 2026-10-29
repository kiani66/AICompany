# AICompany — Production Bootstrap & Security Runbook

**STATUS: Elevated legacy Neon runtime removed; bootstrap/deployment still BLOCKED pending secure login cutover, Vercel isolation, protected secrets and CEO approval. Never merge, migrate, or deploy without explicit CEO approval and all release gates passing.**

## Verified target

- Repository: kiani66/AICompany; draft PR #14, feature/manual-neon-bootstrap-workflow.
- Neon project: jolly-paper-27220159.
- Neon branch: br-quiet-feather-b7ew3f2r (main).
- Database: neondb, PostgreSQL 18.6.
- Direct host: ep-quiet-rice-b7flg3cr.c-13.us-east-1.aws.neon.tech.
- Pooler host: ep-quiet-rice-b7flg3cr-pooler.c-13.us-east-1.aws.neon.tech (**pooler currently disabled**).
- Migration owner: neondb_owner. Approved replacement runtime: aicompany_runtime_restricted (currently NOLOGIN pending secure credential provisioning). Deleted elevated legacy role: aicompany_runtime. Grants group: aicompany_app (NOLOGIN).
- Existing Vercel project: prj_ZV4WoLpd4I3zv59f5rNXay8jTqPs, team team_nPdLGUOJSYke0qNqhQf5joPv. Do not recreate or unlink.

**Endpoint pinning:** The preflight pins the exact host reported by Neon for the above project and branch. If Neon changes endpoints, stop and independently verify the replacement belongs to these IDs before a reviewed update to the guard. Pinning is not a substitute for provider-side project verification.

## P0 remediation progress (2026-10-29)

**Verified change in live Neon:** A SQL-created role named aicompany_runtime_restricted now exists on the original branch/database. It is NOLOGIN (no password provisioned), NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, and inherits exactly one unprivileged NOLOGIN role, aicompany_app. It is not a database owner. No new credential was generated or exposed. These attributes and its one role membership were verified with a live read-only catalog query.

**Legacy P0 REMEDIATED (Neon account deletion verified):** After explicit CEO approval, live checks found no active legacy-runtime sessions, no owned tables/schemas/databases, no shared dependencies, and no application tables in public. The legacy `aicompany_runtime` role was deleted through Neon role management. Verification returned zero matching rows in pg_roles, and the Neon role API returned HTTP 404. The old password can no longer authenticate. The new restricted role remains NOLOGIN, so no production database runtime access is yet configured. Vercel environment credentials cannot be independently audited until its team authorization is fixed; any stale old-role URL is now unusable but still needs removal. The guard retains a fail-closed legacy-role regression check.
Neon documentation: https://neon.com/docs/manage/database-access . New least-privilege roles must be SQL-created; creating a replacement through the Neon UI/API will restore unwanted neon_superuser membership.

### Remaining controlled cutover (legacy role deleted)

1. **Completed:** Authorized legacy role deletion after checking zero live connections, zero owned objects and zero recorded dependencies; confirmed absent through Neon API and pg_roles. Neon role deletion is a separately approved operational incident action, not part of the PR workflow. Vercel configuration remains unverified and must be inspected for stale credentials.
2. Provision a high-entropy credential for aicompany_runtime_restricted in a trusted password manager/admin SQL session, then explicitly enable LOGIN. Use a secure connection and avoid copying any real password into chat, GitHub files/issues, or PR comments. Do not enter the password into an online password-hashing site.
3. Store the new restricted runtime URL only in the GitHub protected production-database environment as AICOMPANY_RUNTIME_DATABASE_URL and Vercel Production as DATABASE_URL. Never put the neondb_owner URL into Vercel, and never give Preview access to the production branch.
4. Remove all references to the old or privileged production credentials from Vercel Preview/Development/Production (including integration-injected variables) before enabling release. Use an isolated nonproduction Neon branch and separate role if Preview needs database access.
5. Re-run catalog checks using read-only SQL and the preflight from the protected workflow; expect the restricted role's effective identity and exactly one aicompany_app membership, with old role absent. The existing preflight currently intentionally fails until restricted LOGIN credentials are provisioned securely.

Read-only role inspection (Neon SQL Editor, neondb_owner):

    SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,
           rolreplication,rolbypassrls
    FROM pg_roles
    WHERE rolname IN ('aicompany_runtime','aicompany_runtime_restricted','aicompany_app');
    SELECT r.rolname AS inherited
    FROM pg_roles r
    WHERE r.oid <> (SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted')
      AND pg_has_role('aicompany_runtime_restricted',r.oid,'MEMBER');

The restricted role should ultimately be LOGIN with no elevated attributes; it must own no database objects and inherit only aicompany_app. The legacy role must not remain an active elevated login. Never run production migrations or deploy until these conditions, environment isolation, and approvals pass.

## GitHub protected environment (mobile)

1. On GitHub mobile browser, request **Desktop site** if needed. Visit https://github.com/kiani66/AICompany/settings/environments and create environment **production-database**.
2. Require reviewers, prevent self-review if available, and restrict deployments to **main**. Check whether these protections are available under your GitHub plan; do not presume they are enabled.
3. In that environment only, securely add AICOMPANY_MIGRATION_DATABASE_URL and AICOMPANY_RUNTIME_DATABASE_URL. Never use repository-wide secrets for the migration owner. The two URLs must use separate roles and credentials and must specify neondb and sslmode=require (or verify-full).
4. Migration credentials must use the **direct** host. Runtime may use direct; pooled is only acceptable after Neon pooler is enabled and separately verified.
5. After code review, the workflow requires manual dispatch from main, exact production confirmation, project and branch inputs, and protection approval. It **does not** run on PR branches. Do not dispatch until secure runtime login, environment isolation and all authorization gates are verified.

## Guarded workflow

- Install locked dependencies and run offline guard tests before providing any production credentials.
- Read-only preflight: exact pinned endpoint, project/branch inputs, database, effective owner/runtime, version, role flags, recursive inherited memberships, non-ownership, allowlisted public/drizzle/neon_auth schemas, absence of unmanaged relations, and canonical migration history hashes.
- Only after preflight passes: repository canonical Drizzle migrate and seed with the migration-owner account; apply scripts/app-privileges.sql as owner.
- Postflight: all 11 migration hashes/timestamps, exact canonical tables, six disabled agents, allowed/forbidden grants, column restrictions, 17 negative-operation probes with transaction rollback.
- Fail closed on any error. No automatic merge or deployment. No secret-bearing variables in checkout or npm ci. Driver exceptions are not printed because they may contain sensitive URLs.
- Before any authorized writes, verify provider backups/snapshots and rollback procedures; this workflow itself is not a backup.

## Vercel variable and integration security (verified 2026-10-29)

**Connected project found and scoped access verified:** `ai-company` project ID `prj_ZV4WoLpd4I3zv59f5rNXay8jTqPs`. Explicitly supplying `teamId` incorrectly caused 404, whereas unscoped project and env actions worked; no project was recreated. The project reports `live=false` and no latest deployment. The existing Neon marketplace storage resource is `aicompany-db` (`store_JAsg8T1S8LZ7wJfl`).

**Actual environment changes:**
- Before remediation: 19 Vercel environment variables; 17 Neon-integration variables exposed in both Production and Preview, plus one integration-provided Preview-only `DATABASE_URL` and one custom Production-only `DATABASE_URL`.
- Changed all 17 dual-target variables to **Production-only** with Vercel edit-project-env, preserving values without fetching plaintext. All 17 edits succeeded, and independent readback confirmed zero variables with dual Production+Preview targeting.
- Requested `previewDeploymentsDisabled: true` via Vercel update-project; request succeeded, but this field is not returned by the available readback API, so dashboard verification is still required.
- Still present: one Preview-only **integration-managed** `DATABASE_URL` (ID `1Kajz6NxMW1tuKN0`), which must be removed/disconnected. The available edit endpoint rejects an empty target and no direct env DELETE action is available in the current connector.
- **Critical upstream drift risk:** Storage `aicompany-db` `projectsMetadata` still shows `environments: [preview, production]`. Re-sync can reintroduce Preview secrets. Changing individual env target scopes is only interim containment, NOT a complete or durable fix. No deployment was triggered.
- Remaining Production-integrated Neon credentials (17 variables) also must not be trusted for runtime: they may belong to a privileged integration role. Values are sensitive and were not retrieved or printed. Only the SQL-created restricted runtime credential may be used by Production after proper cutover.
- The custom Production-only `DATABASE_URL` exists, but its decrypted value was not available to verify which role it targets. It **must be replaced** with a verified `aicompany_runtime_restricted` URL only after secure password provisioning.
- **DONE:** Generated a high-entropy `SESSION_SECRET` using four PostgreSQL CSPRNG UUIDv4 values and created it as a **sensitive Production-only** Vercel environment variable. The value was never output. Vercel readback confirms its name and Production-only scope. `CEO_PASSWORD_HASH` is still absent. Keep Production blocked.

**Manual action required in Vercel console (mobile browser):**
1. Open https://vercel.com → existing `ai-company` project → **Storage / Neon → aicompany-db → Connected Projects / Manage**, and disconnect this project's **Preview** environment at the resource connection source; ideally disconnect this unsafe Integration from the application entirely once any non-production dependencies are understood. Do **not** delete the Neon database or storage resource.
2. In **Settings → Environment Variables**, remove the remaining Preview-only integration-managed `DATABASE_URL`. Inspect all 17 Production integration-managed variables and remove privileged owner/admin URLs/passwords before enabling deployment. Manage this at integration source so automatic resync cannot restore them.
3. Verify that **Preview Deployments** are disabled as an interim safeguard, until Preview has a separate Neon branch and least-privilege credential. No Production database secrets should be available to Preview.
4. Set only the restricted runtime URL as Production `DATABASE_URL`, and configure Production-only `SESSION_SECRET` and bcrypt `CEO_PASSWORD_HASH` through approved secret management. Never post secrets to chat or GitHub.
5. Verify integration sync does not recreate exposures, check Vercel Git auto-deployment settings, and only then review authorization for any Production cutover.

**Current result:** Neon elevated role eliminated; Vercel Preview exposure partially contained; source-level Neon Storage connection and Production owner-credential risk still block release.

## Release gates

- [x] SQL-created restricted role provisioned with NOLOGIN, no password, and verified to inherit only aicompany_app.
- [x] Legacy elevated aicompany_runtime deleted and independently verified absent (2026-10-29); no active sessions or objects found before deletion.
- [ ] Vercel stale legacy connection URLs removed and production/preview variable scopes inspected after Vercel authorization.
- [ ] Restricted runtime credential provisioned securely, enabled for LOGIN and tested on actual Neon.
- [ ] GitHub production-database environment protected by required review.
- [ ] Canonical target hosts, branch and database confirmed; recovery backup available.
- [x] Seventeen Neon integration variables changed from Preview+Production to Production-only; verified by readback.
- [ ] Remaining Preview-only integration DATABASE_URL removed, and Storage-level Preview association disconnected (source currently still both environments).
- [ ] All privileged Neon Integration credentials removed from Vercel Production; only SQL-created restricted runtime DATABASE_URL remains.
- [x] SESSION_SECRET securely provisioned as a Vercel Production-only sensitive environment variable (without logging the value).
- [ ] CEO_PASSWORD_HASH configured securely as Production-only bcrypt hash.
- [ ] PR #14 reviewed; CI/security checks green; explicit CEO approval for merge.
- [ ] Separate explicit CEO approval for any production migration and deployment.

**Current decision: security review may proceed; production deployment is unsafe.**
