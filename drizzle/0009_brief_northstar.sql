CREATE TABLE IF NOT EXISTS "bridge_endpoints" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"machine_id" varchar(255) NOT NULL,
	"endpoint_type" varchar(50) NOT NULL,
	"url" text NOT NULL,
	"api_key" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bridge_endpoints" ADD CONSTRAINT "bridge_endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bridge_endpoints" ADD CONSTRAINT "bridge_endpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bridge_endpoints_project_machine_type_idx" ON "bridge_endpoints" USING btree ("project_id","machine_id","endpoint_type");