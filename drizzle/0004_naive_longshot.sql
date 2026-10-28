CREATE TABLE "runtime_budgets" (
	"scope" text PRIMARY KEY NOT NULL,
	"token_limit" integer NOT NULL,
	"micro_usd_limit" integer NOT NULL,
	"reserved_tokens" integer DEFAULT 0 NOT NULL,
	"reserved_micro_usd" integer DEFAULT 0 NOT NULL,
	"used_tokens" integer DEFAULT 0 NOT NULL,
	"used_micro_usd" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "budget_nonnegative" CHECK ("runtime_budgets"."token_limit" >= 0 and "runtime_budgets"."micro_usd_limit" >= 0 and "runtime_budgets"."reserved_tokens" >= 0 and "runtime_budgets"."reserved_micro_usd" >= 0 and "runtime_budgets"."used_tokens" >= 0 and "runtime_budgets"."used_micro_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "runtime_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"kill_switch" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"kind" text NOT NULL,
	"tokens" integer NOT NULL,
	"micro_usd" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_kind" CHECK ("simulation_ledger"."kind" in ('RESERVE','RELEASE','RECONCILE'))
);
--> statement-breakpoint
CREATE TABLE "simulation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"state" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"estimate_tokens" integer NOT NULL,
	"estimate_micro_usd" integer NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"actor" text DEFAULT 'CEO' NOT NULL,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_runs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "simulation_state" CHECK ("simulation_runs"."state" in ('REQUESTED','AWAITING_APPROVAL','QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED','BLOCKED')),
	CONSTRAINT "simulation_estimates" CHECK ("simulation_runs"."estimate_tokens" > 0 and "simulation_runs"."estimate_micro_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "runtime_settings" ADD CONSTRAINT "runtime_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_ledger" ADD CONSTRAINT "simulation_ledger_run_id_simulation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_run_idx" ON "simulation_ledger" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "simulation_project_idx" ON "simulation_runs" USING btree ("project_id");