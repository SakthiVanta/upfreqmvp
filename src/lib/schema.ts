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

  // Billing — see src/lib/billing/. 'free' is metered (mcp-usage.ts caps
  // MCP tool calls/month); 'pro' is unlimited until planExpiresAt passes,
  // at which point it should be treated as expired back to free (no cron
  // job enforces this yet — checked lazily wherever plan is read).
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at'),
  mcpCallsThisMonth: integer('mcp_calls_this_month').notNull().default(0),
  mcpCallsResetAt: timestamp('mcp_calls_reset_at').defaultNow().notNull(),
  // Separate counter from mcpCalls* — the webapp's own /api/actions dispatch
  // path (registry.execute with source:'api') used to bypass metering
  // entirely, letting an authenticated browser session run unlimited
  // compute-expensive actions (e.g. a ~20s CAD compile) with no cap at all.
  webappCallsThisMonth: integer('webapp_calls_this_month').notNull().default(0),
  webappCallsResetAt: timestamp('webapp_calls_reset_at').defaultNow().notNull(),
  razorpayCustomerId: varchar('razorpay_customer_id', { length: 255 }),
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

// 5d. Bridge Endpoints — per-(project, machine, type) memory of a
// user-hosted service URL (Isaac Sim bridge, Foxglove bridge, Zenoh router)
// running on their own GPU box. UpFreq never hosts or proxies these — it
// only stores the URL a "thing upfreq agent" (the user's own companion
// process) exposes, so simulation/ROS actions and the webapp can look it up
// by (project, machine) instead of the caller re-typing it every time.
export const bridgeEndpoints = pgTable('bridge_endpoints', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  machineId: varchar('machine_id', { length: 255 }).notNull(),
  endpointType: varchar('endpoint_type', { length: 50 }).notNull(), // 'isaac_sim' | 'foxglove' | 'zenoh'
  url: text('url').notNull(),
  apiKey: text('api_key'),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('bridge_endpoints_project_machine_type_idx').on(table.projectId, table.machineId, table.endpointType),
]);

// 5e. CAD Parts — parametric parts authored via upfreq.cad.* (structured
// primitive/boolean tree -> real OpenSCAD source -> real compiled STL via
// openscad-wasm, with mass properties computed from the actual compiled
// mesh, not estimated). scadSource/nodeTreeJson are small text/JSON and
// live here directly; the compiled STL itself is a real binary blob and
// lives in Vercel Blob storage (stlUrl points at it) — this is the "assets"
// table's original S3/MinIO intent, actually wired up, without inventing
// new infra beyond what BLOB_READ_WRITE_TOKEN already provisions.
export const cadParts = pgTable('cad_parts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  nodeTreeJson: jsonb('node_tree_json').notNull(),
  scadSource: text('scad_source').notNull(),
  stlUrl: text('stl_url'),
  massPropertiesJson: jsonb('mass_properties_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5f. Payments — durable audit trail of every Razorpay order this app has
// ever created, independent of users.plan (which is just the current derived
// state). Never delete rows here even if a user's plan later changes —
// this is the record of what was actually charged.
export const payments = pgTable('payments', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  razorpayOrderId: varchar('razorpay_order_id', { length: 255 }).notNull(),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }),
  amountInr: integer('amount_inr').notNull(),
  planId: varchar('plan_id', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('created'), // created, paid, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
}, (table) => [
  uniqueIndex('payments_razorpay_order_idx').on(table.razorpayOrderId),
]);

// 5g. Custom Test Cases — user-authored test specs from
// upfreq.testing.create_test_case. Previously this action returned a
// spec that was never actually saved anywhere; run_test_case would then
// silently run STANDARD_TEST_PRESETS[0] instead of the requested custom
// test if the id didn't match a standard preset — a real safety-tool bug
// (found in a fresh audit pass), not a stub left on purpose.
export const customTestCases = pgTable('custom_test_cases', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),
  environment: varchar('environment', { length: 50 }).notNull(),
  durationSec: integer('duration_sec').notNull().default(5),
  commandType: varchar('command_type', { length: 50 }).notNull(),
  commandParamsJson: jsonb('command_params_json').notNull().default('{}'),
  assertionsJson: jsonb('assertions_json').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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

