import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

// 1. Users Table (Email/Password & GitHub OAuth)
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: text('password_hash'),
  githubId: varchar('github_id', { length: 255 }),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Projects Table (Multi-Repo Containers)
export const projects = pgTable('projects', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Project Repositories Junction Table (Multi-Repo Fleet)
export const projectRepositories = pgTable('project_repositories', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  repoUrl: text('repo_url').notNull(),
  repoName: varchar('repo_name', { length: 255 }).notNull(),
  branch: varchar('branch', { length: 100 }).default('main'),
  isPrimary: boolean('is_primary').default(false),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

// 4. Robots — durable backing store for the Robot Library. `profileJson`
// holds a full RobotProfile (sensors, autonomy modules, data-flow pipeline
// graph, Nav2 stack, topics, chassis). Historically populated by the
// GitHub-repo-audit flow (since retired); nothing currently writes new rows
// here — that's the next phase (persisting robots authored locally via
// Claude Code/MCP). Existing rows from before the retirement still render.
export const robots = pgTable('robots', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'set null' }),
  repoUrl: text('repo_url').notNull(),
  repoName: varchar('repo_name', { length: 255 }).notNull(),
  robotName: varchar('robot_name', { length: 255 }).notNull(),
  rosVersion: varchar('ros_version', { length: 100 }),
  sensorCount: integer('sensor_count').notNull().default(0),
  moduleCount: integer('module_count').notNull().default(0),
  profileJson: jsonb('profile_json').notNull(),
  analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('robots_user_repo_idx').on(table.userId, table.repoUrl),
]);

// 5. Test Runs — records of simulation test execution (in Isaac Sim or
// Newton), run locally via Claude Code/MCP and reported back here so the
// webapp stays an up-to-date log of what's been tested, not a launcher.
export const testRuns = pgTable('test_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 50 }).notNull().default('project'),
  repoUrl: text('repo_url'),
  branch: varchar('branch', { length: 100 }).notNull().default('main'),
  commitSha: varchar('commit_sha', { length: 100 }),
  commitMessage: text('commit_message'),
  environment: varchar('environment', { length: 50 }).notNull().default('grid'),
  /** Which Isaac Sim server ran this — the user's local/remote box today;
   * informational only, no cost attached yet (that's the deferred
   * UpFreq-hosted-GPU-with-billing phase). */
  serverUrl: text('server_url'),
  testCaseId: varchar('test_case_id', { length: 100 }).notNull(),
  testCaseName: varchar('test_case_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  metricsJson: jsonb('metrics_json').notNull().default('{}'),
  assertionsJson: jsonb('assertions_json').notNull().default('[]'),
  logsJson: jsonb('logs_json').notNull().default('[]'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5b. MCP Robots — robots authored locally via Claude Code/Cursor over MCP
// (upfreq.robot.save_robot). Deliberately NOT the same shape as `robots`
// above: that table's RobotProfile is purpose-built for GitHub-repo static
// analysis (repoUrl, autonomy-module evidence, data-flow graphs) — none of
// which exists for a robot a user described to an agent locally. This is
// the honest, much simpler shape for that origin instead of fabricating
// fields that have no real evidence behind them.
export const mcpRobots = pgTable('mcp_robots', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  driveType: varchar('drive_type', { length: 50 }),
  chassisJson: jsonb('chassis_json').notNull().default('{}'),
  sensorsJson: jsonb('sensors_json').notNull().default('[]'),
  urdfXacroXml: text('urdf_xacro_xml'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5c. Workspace Registrations — per-(project, machine) memory of where a
// project's local checkout lives, so Claude Code/Cursor can ask "have I set
// this project up on this computer before" instead of re-cloning blindly.
// `machineId` is a best-effort, client-reported identifier (a UUID the
// local agent persists at ~/.upfreq/machine-id) — not a verified hardware
// fingerprint, never treat it as one.
export const workspaceRegistrations = pgTable('workspace_registrations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  machineId: varchar('machine_id', { length: 255 }).notNull(),
  localPath: text('local_path').notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('workspace_registrations_project_machine_idx').on(table.projectId, table.machineId),
]);

// 6. Versioned Robotics Asset Registry — canonical assets in S3/MinIO
// with semantic contracts (upfreq_asset_contract.yaml).
export const assets = pgTable('assets', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'cascade' }),
  assetId: varchar('asset_id', { length: 100 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // robot_mobile, environment, sensor
  visibility: varchar('visibility', { length: 20 }).notNull().default('public'), // public, private
  contractJson: jsonb('contract_json').notNull().default('{}'),
  storageUri: text('storage_uri'),
  nvmeCachePath: text('nvme_cache_path'),
  physicsScore: integer('physics_score').default(100),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('assets_asset_version_idx').on(table.assetId, table.version),
]);

// 7. Simulation Profiles — dual-engine configuration profiles
// (interactive_inspect, fast_regression, differentiable_tuning).
export const simulationProfiles = pgTable('simulation_profiles', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'cascade' }),
  profileKey: varchar('profile_key', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  engine: varchar('engine', { length: 50 }).notNull(), // isaac_sim, newton_physics
  physicsSolver: varchar('physics_solver', { length: 50 }).notNull(), // physx5, mujoco, warp_differentiable, kamino
  physicsDt: varchar('physics_dt', { length: 30 }).notNull().default('0.016666'),
  rendering: varchar('rendering', { length: 50 }).notNull().default('interactive_rtx'), // interactive_rtx, headless_disabled
  targetRtf: integer('target_rtf').notNull().default(1),
  differentiable: boolean('differentiable').notNull().default(false),
  sensorsJson: jsonb('sensors_json').notNull().default('[]'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Experiments & Pareto Evaluations — multi-candidate A/B regression suites
// with 100% reproducible Run Manifests.
export const experiments = pgTable('experiments', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  simulationEngine: varchar('simulation_engine', { length: 50 }).notNull().default('newton_physics'),
  simulationProfile: varchar('simulation_profile', { length: 100 }).notNull().default('fast_regression'),
  trialsTotal: integer('trials_total').notNull().default(20),
  trialsPassed: integer('trials_passed').notNull().default(0),
  paretoMetricsJson: jsonb('pareto_metrics_json').notNull().default('{}'),
  paretoOutcome: varchar('pareto_outcome', { length: 50 }).notNull().default('PENDING_REVIEW'), // ACCEPT, REJECT, PENDING_REVIEW
  runManifestJson: jsonb('run_manifest_json').notNull().default('{}'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Policy Proposals — controlled execution review queue for agent modifications
// (AST diffs, URDF changes, controller gains).
export const policyProposals = pgTable('policy_proposals', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'cascade' }),
  actionNamespace: varchar('action_namespace', { length: 50 }).notNull(), // upfreq.code, upfreq.robot, upfreq.ros, upfreq.simulation, upfreq.testing
  actionName: varchar('action_name', { length: 100 }).notNull(),
  policyLevel: varchar('policy_level', { length: 20 }).notNull().default('REVIEW'), // ALLOWED, REVIEW, DENIED
  status: varchar('status', { length: 50 }).notNull().default('pending_review'), // pending_review, user_approved, auto_approved, rejected, executed
  targetFile: text('target_file'),
  diffPreview: text('diff_preview'),
  rationale: text('rationale'),
  inputPayloadJson: jsonb('input_payload_json').notNull().default('{}'),
  resultJson: jsonb('result_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

// 10. Agent Chat Messages — embedded agent copilot conversations & proposal references.
export const agentChatMessages = pgTable('agent_chat_messages', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'cascade' }),
  sender: varchar('sender', { length: 20 }).notNull(), // user, agent, system
  content: text('content').notNull(),
  actionProposalsJson: jsonb('action_proposals_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

