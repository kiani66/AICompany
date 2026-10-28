CREATE TABLE "provider_run_preparations" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "company_id" uuid NOT NULL REFERENCES "companies"("id"),
 "project_id" uuid NOT NULL REFERENCES "projects"("id"),
 "proposal_id" uuid NOT NULL REFERENCES "project_plan_proposals"("id"),
 "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
 "idempotency_key" uuid NOT NULL UNIQUE,
 "review_envelope" text NOT NULL,
 "review_digest" text NOT NULL,
 "state" text NOT NULL DEFAULT 'PREVIEWED',
 "version" integer NOT NULL DEFAULT 1,
 "reserved_tokens" integer NOT NULL DEFAULT 0,
 "reserved_micro_usd" integer NOT NULL DEFAULT 0,
 "used_tokens" integer NOT NULL DEFAULT 0,
 "used_micro_usd" integer NOT NULL DEFAULT 0,
 "outcome_reason" text,
 "approved_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "preparation_state" CHECK ("state" IN ('PREVIEWED','APPROVED','RESERVED','RECONCILED','UNRESOLVED','CANCELLED')),
 CONSTRAINT "preparation_version" CHECK ("version" > 0),
 CONSTRAINT "preparation_accounting" CHECK ("reserved_tokens">=0 AND "reserved_micro_usd">=0 AND "used_tokens">=0 AND "used_micro_usd">=0)
);
--> statement-breakpoint
CREATE INDEX "preparation_project_idx" ON "provider_run_preparations" ("project_id","created_at","id");
--> statement-breakpoint
CREATE TABLE "provider_preparation_ledger" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "preparation_id" uuid NOT NULL REFERENCES "provider_run_preparations"("id"),
 "scope" text NOT NULL,
 "kind" text NOT NULL,
 "tokens" integer NOT NULL,
 "micro_usd" integer NOT NULL,
 "evidence" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "preparation_ledger_kind" CHECK ("kind" IN ('RESERVE','RELEASE','RECONCILE','HOLD')),
 CONSTRAINT "preparation_ledger_amounts" CHECK ("tokens">=0 AND "micro_usd">=0)
);
--> statement-breakpoint
CREATE INDEX "preparation_ledger_run_idx" ON "provider_preparation_ledger" ("preparation_id","created_at","id");
