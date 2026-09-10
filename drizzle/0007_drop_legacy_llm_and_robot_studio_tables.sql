ALTER TABLE IF EXISTS "agent_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "audit_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "provider_models" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "robot_design_mesh_files" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "robot_designs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "user_api_keys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "agent_settings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_runs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "provider_models" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "robot_design_mesh_files" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "robot_designs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_api_keys" CASCADE;--> statement-breakpoint
ALTER TABLE "test_runs" DROP CONSTRAINT IF EXISTS "test_runs_robot_design_id_robot_designs_id_fk";
--> statement-breakpoint
ALTER TABLE "test_runs" DROP COLUMN IF EXISTS "robot_design_id";
