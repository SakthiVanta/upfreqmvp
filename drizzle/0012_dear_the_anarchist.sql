CREATE TABLE IF NOT EXISTS "custom_test_cases" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"environment" varchar(50) NOT NULL,
	"duration_sec" integer DEFAULT 5 NOT NULL,
	"command_type" varchar(50) NOT NULL,
	"command_params_json" jsonb DEFAULT '{}' NOT NULL,
	"assertions_json" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "custom_test_cases" ADD CONSTRAINT "custom_test_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;