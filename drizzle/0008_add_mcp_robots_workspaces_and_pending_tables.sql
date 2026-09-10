CREATE TABLE "agent_chat_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"sender" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"action_proposals_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"asset_id" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"contract_json" jsonb DEFAULT '{}' NOT NULL,
	"storage_uri" text,
	"nvme_cache_path" text,
	"physics_score" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"title" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"simulation_engine" varchar(50) DEFAULT 'newton_physics' NOT NULL,
	"simulation_profile" varchar(100) DEFAULT 'fast_regression' NOT NULL,
	"trials_total" integer DEFAULT 20 NOT NULL,
	"trials_passed" integer DEFAULT 0 NOT NULL,
	"pareto_metrics_json" jsonb DEFAULT '{}' NOT NULL,
	"pareto_outcome" varchar(50) DEFAULT 'PENDING_REVIEW' NOT NULL,
	"run_manifest_json" jsonb DEFAULT '{}' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_robots" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"description" text,
	"drive_type" varchar(50),
	"chassis_json" jsonb DEFAULT '{}' NOT NULL,
	"sensors_json" jsonb DEFAULT '[]' NOT NULL,
	"urdf_xacro_xml" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_proposals" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"action_namespace" varchar(50) NOT NULL,
	"action_name" varchar(100) NOT NULL,
	"policy_level" varchar(20) DEFAULT 'REVIEW' NOT NULL,
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"target_file" text,
	"diff_preview" text,
	"rationale" text,
	"input_payload_json" jsonb DEFAULT '{}' NOT NULL,
	"result_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "simulation_profiles" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"profile_key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"engine" varchar(50) NOT NULL,
	"physics_solver" varchar(50) NOT NULL,
	"physics_dt" varchar(30) DEFAULT '0.016666' NOT NULL,
	"rendering" varchar(50) DEFAULT 'interactive_rtx' NOT NULL,
	"target_rtf" integer DEFAULT 1 NOT NULL,
	"differentiable" boolean DEFAULT false NOT NULL,
	"sensors_json" jsonb DEFAULT '[]' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_registrations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"machine_id" varchar(255) NOT NULL,
	"local_path" text NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "server_url" text;--> statement-breakpoint
ALTER TABLE "agent_chat_messages" ADD CONSTRAINT "agent_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_messages" ADD CONSTRAINT "agent_chat_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_robots" ADD CONSTRAINT "mcp_robots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_robots" ADD CONSTRAINT "mcp_robots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_proposals" ADD CONSTRAINT "policy_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_proposals" ADD CONSTRAINT "policy_proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_profiles" ADD CONSTRAINT "simulation_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_registrations" ADD CONSTRAINT "workspace_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_registrations" ADD CONSTRAINT "workspace_registrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_asset_version_idx" ON "assets" USING btree ("asset_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_registrations_project_machine_idx" ON "workspace_registrations" USING btree ("project_id","machine_id");