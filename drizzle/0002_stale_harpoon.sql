CREATE TABLE "provider_models" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"label" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_models_provider_model_idx" ON "provider_models" USING btree ("provider","model_id");