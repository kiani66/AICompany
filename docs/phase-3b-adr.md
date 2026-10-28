# Phase 3B provider boundary — incomplete, activation prohibited

Status: design and deterministic mock contract only. No real provider is selected or callable and no environment variable can activate one. The existing Phase 3A policy denies real execution and every agent remains disabled. The mock returns a fixed structured plan; output is untrusted data, never instructions or authority to use tools or create tasks. The Zod contract rejects unknown fields and bounds output size.

Before implementation can be considered complete, design and test an immutable CEO-reviewed sanitized input snapshot bound to per-run consent, model, provider, pricing and capabilities. Do not rely on regex redaction to guarantee removal of secrets or sensitive data. Model-provided text may contain prompt injection and must not influence system instructions or trigger tools. Choose a provider only under a separate CEO decision with a privacy and retention review. No keys, model endpoint or live requests belong in this public repository or tests.

A real adapter must preserve atomic budget reservation, idempotency, kill-switch checks and approval under concurrency. A timeout or ambiguous provider outcome may have incurred charges: retain the reservation and mark usage unresolved for operator reconciliation. Never silently report zero cost or retry an ambiguous request. Store provider request IDs and actual usage only where safe, validate structured responses and enforce output limits. Define failure recovery, rate limits, concurrency caps and an explicit activation procedure; configuration alone must never grant permission.

Operator checklist for a future separately approved activation: review provider/model, ceiling, data retention, privacy and key rotation; secure endpoint allowlisting and secrets; verify non-owner database grants and audit provenance; address Phase 1 ingress and login availability risks and Phase 2 pagination limits; test kill switch and accounting with mocks; obtain explicit CEO approval for activation and the first request. Do not activate, deploy or call a real provider as part of this phase.


## Mock-only CEO proposal workflow (incremental implementation)

The CEO dashboard now provides `/project-plan` and the guarded `/api/project-plan/preview` and `/api/project-plan/proposals` routes. A bounded synthetic project description can be previewed with the deterministic mock and, after an explicit data-storage acknowledgement, saved as a `REVIEW_REQUIRED` proposal for an active project. The saved record contains a snapshot of the exact submitted description, SHA-256 digest, fixed mock provider/model, validated mock result, and version. CEO acceptance/rejection is optimistic-versioned; neither action creates tasks, invokes an agent, enables a provider, consumes provider tokens, or reserves real budget. These decisions are reference-only, **not consent for billable inference**.

The application DB role may insert and read proposal records and update only `status`, `version` and `decided_at`; it may not mutate saved inputs, digests or outputs through its granted privileges. The role grants need to be re-applied and verified on every actual installation. Database owners can still rewrite records, and a compromised runtime can insert fabricated records or audit entries. The mock request is synchronous and makes no outbound provider calls. The proposal list intentionally returns at most 50 records and must move to server-side cursor pagination for scale.

**Privacy boundary:** The source description is stored as plaintext for CEO review. The UI explicitly warns to use synthetic data only; neither bounded length nor a checkbox guarantees redaction. Do not store customer documents or secrets in this prototype. Access and deletion/retention policy must be designed and verified before any sensitive input is permitted.

**Still incomplete:** no real-provider adapter or execution activation, immutable consent bound to a billable request, real cost estimates/reservations, uncertain-billing recovery, provider reconciliation, concurrency limits for provider calls, real execution authorization, or production security acceptance. Existing Phase 1/2/3A blockers remain. A mocked proposal preview is not a real AI run and never signifies CEO authorization to spend.


## Non-executing future-provider contract

`src/lib/provider-boundary.ts` now defines a validated outbound review envelope bound to the exact input digest, provider/model identity, pricing version, permitted capabilities (empty), token ceilings and maximum approved micro-USD charge. The envelope digest is **not** an authorization token or proof of CEO consent. Future implementation must persist the independently approved envelope and compare it transactionally at the actual execution boundary against the exact outgoing payload. The current Project Manager mock proposal acknowledgement is only permission to store synthetic preview data; it is NOT approval to call a paid provider.

The provider-outcome accounting contract distinguishes verified completion from verified no-charge and ambiguous outcomes. TIMEOUT/CONNECTION_LOST/UNKNOWN_RESPONSE and usage exceeding reserved amount map to HOLD_FOR_REVIEW with no automatic retry. These are tested pure policy contracts, **not yet integrated** with database reservations or real provider calls. Real inference remains hard-disabled and no endpoint, key, SDK or callable adapter is configured.

### Additional verification work
The initial E2E run for the new saved-input display failed due to an ambiguous Playwright text locator (textarea and paragraph contained the same value), not a demonstrated storage failure. The locator was scoped to the persisted-display paragraph and requires a fresh CI pass. Do not mark this phase as accepted before all current-head checks pass.
