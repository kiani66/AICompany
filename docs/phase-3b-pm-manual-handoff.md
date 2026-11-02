# Phase 3B — Product Manager manual handoff (no model API)

Status: proposed implementation contract. This document does not activate an agent.

## Objective
Allow the CEO to assign a product discovery task to the Product Manager role, prepare a copyable brief for ChatGPT Plus, and manually record the reviewed result. Never imply that the subscription UI is callable by the server.

## Workflow
1. CEO creates a project/task through the existing authenticated Phase 2 workflow.
2. CEO selects the PM role and generates a *draft* handoff brief using deterministic templates and existing project/task metadata.
3. UI displays the brief with a Copy action. CEO performs analysis in ChatGPT Plus independently.
4. CEO pastes the result back, edits it, and explicitly submits it as a human-supplied artifact.
5. Persist attribution (CEO-submitted; external analysis not verified), timestamp, task and version, and immutable audit evidence. No automatic DONE transition.
6. CEO reviews and approves the artifact before unlocking any dependent development task. Rejection preserves prior evidence and supports resubmission.

## Boundaries
- No OpenAI/Anthropic API calls, browser automation, subscription credential scraping, or provider impersonation.
- No execution through the Phase 3A fake provider. Its kill switch and disabled-agent constraints remain unchanged.
- Do not post full prompts or results to Telegram or GitHub by default.
- No deployment, spending, merge or agent activation without CEO approval.
- All writes require CEO session, origin checks, validated size-limited input, optimistic concurrency and transactional audit recording.
- Artifacts must be treated as untrusted input, displayed as escaped text, not executed as HTML/commands.
- Include a future provider interface (manual vs API) only after tests demonstrate no implicit network execution.

## Acceptance criteria
- CEO can copy a PM brief and manually submit a response.
- A response cannot be marked AI-generated/verified by the system.
- Unauthorized and cross-origin writes fail; stale versions conflict.
- A rejected submission does not satisfy dependent-task approval gates.
- Existing Phase 1–3A tests and security constraints continue to pass.
- Unit, integration and E2E tests cover the manual flow and audit trail.

## Suggested implementation sequence
1. Inspect existing task, approval and audit schemas and reuse their patterns.
2. Add persisted handoff request and submission records with explicit provenance.
3. Implement authenticated endpoints and versioned transitions.
4. Add CEO dashboard copy/paste/review UI.
5. Add tests and submit for review; no merge/deploy in this change.
