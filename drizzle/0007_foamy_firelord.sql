CREATE TABLE "runtime_denials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"operation" text NOT NULL,
	"reason" text NOT NULL,
	"policy_version" text NOT NULL,
	"context" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "denial_count_positive" CHECK ("runtime_denials"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "simulation_runs" DROP CONSTRAINT "simulation_state";--> statement-breakpoint
ALTER TABLE "runtime_denials" ADD CONSTRAINT "runtime_denials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "denial_bucket_unique" ON "runtime_denials" USING btree ("company_id","operation","reason","window_start");--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_state" CHECK ("simulation_runs"."state" in ('AWAITING_APPROVAL','QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED'));