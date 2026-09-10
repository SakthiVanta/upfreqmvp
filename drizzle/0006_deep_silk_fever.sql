CREATE TABLE "test_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"robot_design_id" varchar(255),
	"target_type" varchar(50) DEFAULT 'project' NOT NULL,
	"repo_url" text,
	"branch" varchar(100) DEFAULT 'main' NOT NULL,
	"commit_sha" varchar(100),
	"commit_message" text,
	"environment" varchar(50) DEFAULT 'grid' NOT NULL,
	"test_case_id" varchar(100) NOT NULL,
	"test_case_name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"metrics_json" jsonb DEFAULT '{}' NOT NULL,
	"assertions_json" jsonb DEFAULT '[]' NOT NULL,
	"logs_json" jsonb DEFAULT '[]' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_robot_design_id_robot_designs_id_fk" FOREIGN KEY ("robot_design_id") REFERENCES "public"."robot_designs"("id") ON DELETE cascade ON UPDATE no action;