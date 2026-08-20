CREATE TABLE "audit_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"repo_url" text NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(150) NOT NULL,
	"used_agentic_analysis" boolean NOT NULL,
	"tool_call_count" integer,
	"api_call_count" integer,
	"input_tokens" integer,
	"cached_input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"duration_ms" integer NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_settings" ADD COLUMN "effort" varchar(20);--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;