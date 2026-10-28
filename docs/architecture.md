# Architecture and operating policy

Next.js App Router serves a CEO-only dashboard and read-only JSON endpoints. A signed, HTTP-only, same-site session protects all routes except login and minimal health. The CEO password is supplied as a bcrypt hash; there is no registration. PostgreSQL is the source of dashboard counts and lists, accessed via Drizzle. Migrations define the data model; a repeatable seed creates the company and six disabled role definitions only.

## Organization

The Project Manager reports to the CEO. The Software Architect, QA Engineer, and Code Reviewer & DevOps report to the Project Manager; Backend and Frontend Developers report to the Software Architect. Role files and foundation policy are version controlled. Agents are records only.

## Data model

Company owns agents, projects, approvals, audit events and usage records. AgentCapability belongs to an agent; Project owns tasks; TaskDependency links tasks; TaskExecution belongs to a task and agent and owns checkpoints; AgentReport belongs to an agent. Foreign keys, unique keys, checks and lookup indexes protect the basic relationships. Application-level cycle detection must be applied transactionally before a future dependency write API is added.

## Security and cost

Set a unique high-entropy CEO password hash and a random session secret securely in the runtime environment. Rotate the session secret to invalidate sessions. Do not expose production data or credentials in this public repository. The process-local login throttle is only a development safeguard, not a distributed rate limiter; production requires a trusted reverse proxy and shared rate limiting, plus security review. Use HTTPS in production. Proxy origin/host handling must be configured safely. AI execution and network providers are absent, so Phase 1 incurs no AI usage cost. Do not provision paid services.

Vercel Hobby is intended for personal non-commercial development/testing only; commercial use requires a permitted plan or host. No deployment is authorized. This app remains portable to another Node/PostgreSQL host.

## Phase 2 backlog

Design and review durable authentication/rate limiting and audit logging, authorization and approval persistence, transactional dependency validation, a safe runner and checkpoint recovery, provider adapters, cost controls, monitoring, and operational deployment. Interfaces in Phase 1 are contracts only; they are not a runner and cannot resume work. No customer projects should be created before separate approval.
