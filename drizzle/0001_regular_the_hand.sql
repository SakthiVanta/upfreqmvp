CREATE TABLE "agent_settings" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"provider" varchar(50) DEFAULT 'gemini' NOT NULL,
	"model" varchar(150) DEFAULT 'gemini-3.5-flash-lite' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_settings" ADD CONSTRAINT "agent_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;