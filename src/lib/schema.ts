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

// 4. Robots — one row per completed audit. `profileJson` holds the full
// RobotProfile exactly as /api/analyze produces it (sensors, evidence-based
// autonomy module classification, data-flow pipeline graph, Nav2 stack,
// topics, chassis) — this is the durable backing store for the Robot
// Library. Re-auditing the same repo for the same user updates the row
// in place rather than accumulating duplicates.
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

// 5. Agent Settings — one row per user, picking which LLM provider/model the
// audit agent (see src/lib/agent/) runs against. Never stores API keys —
// those stay server-only env vars (GEMINI_API_KEY, ANTHROPIC_API_KEY,
// OPENAI_API_KEY, OPENROUTER_API_KEY); this table only stores the choice.
export const agentSettings = pgTable('agent_settings', {
  userId: varchar('user_id', { length: 255 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull().default('gemini'),
  model: varchar('model', { length: 150 }).notNull().default('gemini-3.5-flash-lite'),
  /** Anthropic's output_config.effort (low/medium/high/xhigh/max) — null
   * means "use the API default (high)". Ignored by every other provider. */
  effort: varchar('effort', { length: 20 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Provider Models — the Settings page's model dropdown, seeded from each
// provider's real catalog (src/lib/db/provider-models.ts) rather than
// hardcoded only in the frontend. Re-seed when a provider ships new models;
// this table is a curated convenience list, not a live model whitelist —
// the app accepts any model id string a user types in.
export const providerModels = pgTable('provider_models', {
  id: varchar('id', { length: 255 }).primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull(),
  modelId: varchar('model_id', { length: 200 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  uniqueIndex('provider_models_provider_model_idx').on(table.provider, table.modelId),
]);

// 7. User API Keys — one row per (user, provider), encrypted at rest
// (src/lib/crypto.ts, AES-256-GCM keyed off AUTH_SECRET). Primary source
// for the agent's provider credentials; server env vars (GEMINI_API_KEY
// etc.) are only the fallback when no row exists — see
// src/lib/db/api-keys.ts resolveApiKey(). The raw key is never returned to
// the client after saving, only `keyPreview`.
export const userApiKeys = pgTable('user_api_keys', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  keyPreview: varchar('key_preview', { length: 20 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_api_keys_user_provider_idx').on(table.userId, table.provider),
]);

// 9. Robot Designs — Level 1 manual URDF builder. One row per design a user
// is building by hand: upload mesh files, place them as links, wire up
// joints, export URDF. Distinct from `robots` (repo-audit results) — this
// table has no repo, no analysis, just user-authored structure.
export const robotDesigns = pgTable('robot_designs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  linksJson: jsonb('links_json').notNull().default('[]'),
  jointsJson: jsonb('joints_json').notNull().default('[]'),
  urdfXml: text('urdf_xml'),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Robot Design Mesh Files — one row per uploaded mesh (Vercel Blob), FK'd
// to the design it belongs to. Kept as its own table rather than embedding
// URLs inside links_json so an uploaded file can exist before it's assigned
// to a link, orphaned/unassigned blobs stay queryable, and blobPathname
// (needed for @vercel/blob's del()) stays separate from the public blobUrl
// handed to the 3D viewer.
export const robotDesignMeshFiles = pgTable('robot_design_mesh_files', {
  id: varchar('id', { length: 255 }).primaryKey(),
  designId: varchar('design_id', { length: 255 }).notNull().references(() => robotDesigns.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  blobUrl: text('blob_url').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  originalFilename: varchar('original_filename', { length: 500 }).notNull(),
  extension: varchar('extension', { length: 10 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// 11. Audit Runs — telemetry for every /api/analyze run: real token usage
// pulled from each provider's own response (see src/lib/agent/), not
// estimated. This is the only source of truth for "how much does an audit
// actually cost" — before this table existed there was no way to answer
// that question at all. Written whether the run succeeded, fell back to the
// regex parser, or errored, so failures are visible too.
export const auditRuns = pgTable('audit_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'set null' }),
  repoUrl: text('repo_url').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  model: varchar('model', { length: 150 }).notNull(),
  usedAgenticAnalysis: boolean('used_agentic_analysis').notNull(),
  /** Null when the agent path never ran at all (e.g. no key configured) — a
   * distinct case from ran-but-fell-back partway through. */
  toolCallCount: integer('tool_call_count'),
  apiCallCount: integer('api_call_count'),
  inputTokens: integer('input_tokens'),
  cachedInputTokens: integer('cached_input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),
  durationMs: integer('duration_ms').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
