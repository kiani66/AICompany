# AICompany Neon production bootstrap (manual only)

Target Neon project: `jolly-paper-27220159`, Vercel project: `ai-company` (team `team_nPdLGUOJSYke0qNqhQf5joPv`). The workflow does **not** create Neon roles or credentials, modify Vercel settings, or deploy.

## Prerequisites (complete securely before running)
1. Verify the Neon project/branch/database in the provider dashboard. The workflow verifies matching Neon host and database name, **not the Neon project ID**; a human must check the target. Neon default database observed: `neondb`.
2. Provision a dedicated migration owner URL and a distinct, non-owner runtime LOGIN role. The runtime role must be a member of the NOLOGIN `aicompany_app` role (see `scripts/app-privileges.sql`). Do not grant the runtime role owner/DDL privileges. The owner may create `aicompany_app` via the grants script, but the runtime LOGIN and membership must be provisioned separately before running.
3. In GitHub repository Settings → Environments, create `production-database` with required reviewer protection. Store two environment secrets: `AICOMPANY_MIGRATION_DATABASE_URL` and `AICOMPANY_RUNTIME_DATABASE_URL`. Do not store owner credentials in Vercel.
4. Confirm the GitHub Actions runner can connect to Neon. Avoid printing connection strings.
5. Run Actions → Manual Neon database bootstrap → Run workflow with confirmation `BOOTSTRAP-AICOMPANY`. This is a **write operation** against the selected database; run only after reviewing the target and workflow PR.

The job checks version and unmanaged schema, runs canonical Drizzle migrations and seed, reapplies SQL grants, then checks six disabled agents and restricted runtime permissions. It is repeatable but **not a substitute** for backups, provider-specific smoke testing or a release review. It cannot provision a non-owner login or guarantee Neon project identity from URL alone.

After a successful run, set Vercel Production `DATABASE_URL` to the **runtime** credential only, and add a stable `SESSION_SECRET` and bcrypt `CEO_PASSWORD_HASH` via Vercel's secure UI. Keep migration credentials in GitHub's protected environment, not application runtime. Review Vercel deployment settings and only then initiate deployment.
