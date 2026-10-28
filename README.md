# AICompany

Phase 1 is a CEO control plane for six **disabled** AI employee definitions. It does not run agents, invoke AI providers, create customer projects, or deploy. See [architecture and policies](docs/architecture.md) and [Foundation governance](policies/FOUNDATION.md).

## Requirements

Node.js 22, npm, and PostgreSQL 16. Use a disposable database for tests; integration tests expect it to contain no project or activity data. No paid services are required.

## Setup

```sh
npm ci
export DATABASE_URL='postgres://USER:PASSWORD@localhost:5432/aicompany'
export SESSION_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
# Enter a strong password without echoing it; output is a bcrypt hash, not the password.
read -rs CEO_PASSWORD; echo
export CEO_PASSWORD_HASH="$(CEO_PASSWORD="$CEO_PASSWORD" node -e "console.log(require('bcryptjs').hashSync(process.env.CEO_PASSWORD,12))")"
unset CEO_PASSWORD
npm run db:migrate
npm run db:seed
npm run dev
```

Use secure environment settings for persistent credentials; do not commit `.env` files. The seed is repeatable and creates only company/role definitions and capabilities. For a different shell or managed host, set the same three variables securely. The login process needs the password used to generate the bcrypt hash. `SESSION_SECRET` must be at least 32 characters and must remain stable across instances.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration  # disposable, empty PostgreSQL database; migrates and seeds twice
npm run build
npx playwright install chromium
export TEST_CEO_PASSWORD='the-password-used-for-the-test-hash'
npm run test:e2e
```

For E2E use an isolated test database already migrated and seeded, with `CEO_PASSWORD_HASH` generated from `TEST_CEO_PASSWORD`. The Playwright test starts a local development server. CI supplies a disposable PostgreSQL service and test-only credentials. `npm run db:generate` generates migrations after schema changes; inspect and commit them. `npm start` starts a built application. The health endpoint returns process status only; other endpoints require a session.

GitHub is the source of truth; use feature branches and reviewed pull requests. Never merge, deploy, activate agents, or spend without CEO approval. Vercel Hobby is suitable only for personal non-commercial development/testing; no deployment is part of this phase.

Phase 2 adds a CEO-directed simulation workflow; see [workflow documentation](docs/phase-2.md). No AI employees execute work. Apply new migrations with `npm run db:migrate` before starting the application.
