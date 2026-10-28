CREATE TABLE "pm_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handoff_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"content" text NOT NULL,
	"provenance" text DEFAULT 'CEO-submitted — external analysis not verified' NOT NULL,
	"approval_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pm_artifacts_approval_id_unique" UNIQUE("approval_id"),
	CONSTRAINT "pm_provenance" CHECK ("pm_artifacts"."provenance" = 'CEO-submitted — external analysis not verified')
);
--> statement-breakpoint
CREATE TABLE "pm_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"task_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"brief" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pm_handoffs_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
ALTER TABLE "pm_artifacts" ADD CONSTRAINT "pm_artifacts_handoff_id_pm_handoffs_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."pm_handoffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_artifacts" ADD CONSTRAINT "pm_artifacts_approval_id_approval_requests_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_handoffs" ADD CONSTRAINT "pm_handoffs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pm_revision_unique" ON "pm_artifacts" USING btree ("handoff_id","revision");