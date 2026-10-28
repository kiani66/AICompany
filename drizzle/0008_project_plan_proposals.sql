CREATE TABLE "project_plan_proposals" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "company_id" uuid NOT NULL REFERENCES "companies"("id"),
 "project_id" uuid NOT NULL REFERENCES "projects"("id"),
 "actor" text NOT NULL DEFAULT 'CEO',
 "provider" text NOT NULL DEFAULT 'local-deterministic-mock',
 "model" text NOT NULL DEFAULT 'deterministic-mock-v1',
 "snapshot" text NOT NULL,
 "snapshot_sha256" text NOT NULL,
 "proposal" text NOT NULL,
 "status" text NOT NULL DEFAULT 'REVIEW_REQUIRED',
 "version" integer NOT NULL DEFAULT 1,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "decided_at" timestamp with time zone,
 CONSTRAINT "project_plan_status_check" CHECK ("status" IN ('REVIEW_REQUIRED','ACCEPTED','REJECTED')),
 CONSTRAINT "project_plan_version_check" CHECK ("version" > 0),
 CONSTRAINT "project_plan_snapshot_len_check" CHECK (char_length("snapshot") BETWEEN 1 AND 2000),
 CONSTRAINT "project_plan_provider_check" CHECK ("provider" = 'local-deterministic-mock' AND "model" = 'deterministic-mock-v1')
);
--> statement-breakpoint
CREATE INDEX "plan_company_created_idx" ON "project_plan_proposals" ("company_id","created_at","id");
--> statement-breakpoint
CREATE INDEX "plan_project_idx" ON "project_plan_proposals" ("project_id");
