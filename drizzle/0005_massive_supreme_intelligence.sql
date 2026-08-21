CREATE TABLE "robot_design_mesh_files" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"design_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"extension" varchar(10) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robot_designs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"description" text,
	"links_json" jsonb DEFAULT '[]' NOT NULL,
	"joints_json" jsonb DEFAULT '[]' NOT NULL,
	"urdf_xml" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "robot_design_mesh_files" ADD CONSTRAINT "robot_design_mesh_files_design_id_robot_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."robot_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_design_mesh_files" ADD CONSTRAINT "robot_design_mesh_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_designs" ADD CONSTRAINT "robot_designs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_designs" ADD CONSTRAINT "robot_designs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;