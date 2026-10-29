# AICompany — Production Bootstrap & Security Runbook

**STATUS: BLOCKED (P0). Never merge, migrate, or deploy without explicit CEO approval and all release gates passing.**

## Verified target

- Repository: kiani66/AICompany; draft PR #14, feature/manual-neon-bootstrap-workflow.
- Neon project: jolly-paper-27220159.
- Neon branch: br-quiet-feather-b7ew3f2r (main).
- Database: neondb, PostgreSQL 18.6.
- Direct host: ep-quiet-rice-b7flg3cr.c-13.us-east-1.aws.neon.tech.
- Pooler host: ep-quiet-rice-b7flg3cr-pooler.c-13.us-east-1.aws.neon.tech (**pooler currently disabled**).
- Migration owner: neondb_owner. Approved replacement runtime: aicompany_runtime_restricted (currently NOLOGIN pending secure credential provisioning). Legacy elevated role: aicompany_runtime. Grants group: aicompany_app (NOLOGIN).
- Existing Vercel project: prj_ZV4WoLpd4I3zv59f5rNXay8jTqPs, team team_nPdLGUOJSYke0qNqhQf5joPv. Do not recreate or unlink.

**Endpoint pinning:** The preflight pins the exact host reported by Neon for the above project and branch. If Neon changes endpoints, stop and independently verify the replacement belongs to these IDs before a reviewed update to the guard. Pinning is not a substitute for provider-side project verification.

## P0 remediation progress (2026-10-29)

**Verified change in live Neon:** A SQL-created role named aicompany_runtime_restricted now exists on the original branch/database. It is NOLOGIN (no password provisioned), NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, and inherits exactly one unprivileged NOLOGIN role, aicompany_app. It is not a database owner. No new credential was generated or exposed. These attributes and its one role membership were verified with a live read-only catalog query.

**Legacy P0 still ACTIVE:** The original Neon API/Console-created aicompany_runtime remains LOGIN and inherits neon_superuser with elevated role attributes. Attempts by neondb_owner to ALTER the legacy role or REVOKE neon_superuser failed with permission denied. Nothing was changed on the legacy role. The preflight now explicitly rejects an active or elevated legacy role, even when a restricted credential is otherwise supplied. Do not bootstrap yet.

Neon documentation: https://neon.com/docs/manage/database-access . New least-privilege roles must be SQL-created; creating a replacement through the Neon UI/API will restore unwanted neon_superuser membership.

### Remaining controlled cutover

1. Obtain CEO authorization for retiring/deleting the **old** role after checking existing connection usage and the Vercel integration. Neon role deletion is destructive and is **not** included in this PR's workflow. Until old credentials are revoked, old role still poses a P0 risk.
2. Provision a high-entropy credential for aicompany_runtime_restricted in a trusted password manager/admin SQL session, then explicitly enable LOGIN. Use a secure connection and avoid copying any real password into chat, GitHub files/issues, or PR comments. Do not enter the password into an online password-hashing site.
3. Store the new restricted runtime URL only in the GitHub protected production-database environment as AICOMPANY_RUNTIME_DATABASE_URL and Vercel Production as DATABASE_URL. Never put the neondb_owner URL into Vercel, and never give Preview access to the production branch.
4. Remove all references to the old or privileged production credentials from Vercel Preview/Development/Production (including integration-injected variables) before enabling release. Use an isolated nonproduction Neon branch and separate role if Preview needs database access.
5. Re-run catalog checks using read-only SQL and the preflight from the protected workflow; expect the restricted role's effective identity and exactly one aicompany_app membership, with old role absent or fully inactive and unprivileged.

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
5. After code review, the workflow requires manual dispatch from main, exact production confirmation, project and branch inputs, and protection approval. It **does not** run on PR branches. Do not dispatch while P0 remains.

## Guarded workflow

- Install locked dependencies and run offline guard tests before providing any production credentials.
- Read-only preflight: exact pinned endpoint, project/branch inputs, database, effective owner/runtime, version, role flags, recursive inherited memberships, non-ownership, allowlisted public/drizzle/neon_auth schemas, absence of unmanaged relations, and canonical migration history hashes.
- Only after preflight passes: repository canonical Drizzle migrate and seed with the migration-owner account; apply scripts/app-privileges.sql as owner.
- Postflight: all 11 migration hashes/timestamps, exact canonical tables, six disabled agents, allowed/forbidden grants, column restrictions, 17 negative-operation probes with transaction rollback.
- Fail closed on any error. No automatic merge or deployment. No secret-bearing variables in checkout or npm ci. Driver exceptions are not printed because they may contain sensitive URLs.
- Before any authorized writes, verify provider backups/snapshots and rollback procedures; this workflow itself is not a backup.

## Vercel variable and integration security (mobile)

**Remote Vercel inspection is not verified.** The connected app returned Project not found (404) and no app access (403) for the supplied team/project; remote changes were not made.

1. Open https://vercel.com, select the existing team and project, then **Settings → Environment Variables**. Also inspect **Integrations / Storage → Neon**.
2. Inventory database-bearing variables: DATABASE_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING, POSTGRES_PRISMA_URL, PGHOST, PGUSER, PGPASSWORD, NEON_DATABASE_URL and other Neon integration variables.
3. Check Production, Preview, Development and branch-specific scopes separately. **Remove Production database credentials from Preview** and ensure any integration cannot reinject them. Use a separate nonproduction Neon branch and limited role for Preview, or no Preview DB credentials at all.
4. Production DATABASE_URL must use only the verified restricted runtime account. No migration-owner, admin, or neon_superuser credentials at any Vercel target.
5. Configure Production-only SESSION_SECRET with strong random entropy and CEO_PASSWORD_HASH as a properly generated bcrypt hash. Use a trusted local password-hashing process; the CEO must never paste the plaintext password into GitHub, chat, PRs, issues or an untrusted web hash generator.
6. Preserve the existing project and Git integration. Check **Settings → Git** and block automatic Production deployments before any merge; GitHub CI has no deploy step but the Vercel Git integration can deploy independently.
7. Recheck all variable scopes **after** saving changes and after any integration synchronization. Do not accept deployment prompts before separate CEO authorization.

## Release gates

- [x] SQL-created restricted role provisioned with NOLOGIN, no password, and verified to inherit only aicompany_app.
- [ ] Legacy elevated aicompany_runtime retired/disabled and no production app or integration still uses its credentials.
- [ ] Restricted runtime credential provisioned securely, enabled for LOGIN and tested on actual Neon.
- [ ] GitHub production-database environment protected by required review.
- [ ] Canonical target hosts, branch and database confirmed; recovery backup available.
- [ ] Vercel Production only restricted runtime credentials; Preview isolated including integration-injected variables.
- [ ] SESSION_SECRET and CEO_PASSWORD_HASH configured securely.
- [ ] PR #14 reviewed; CI/security checks green; explicit CEO approval for merge.
- [ ] Separate explicit CEO approval for any production migration and deployment.

**Current decision: security review may proceed; production deployment is unsafe.**
