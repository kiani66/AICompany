ALTER TABLE "approval_requests" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "acceptance_criteria" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_agents_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "project_status" CHECK ("projects"."status" in ('active','archived'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "project_priority" CHECK ("projects"."priority" in ('low','medium','high'));