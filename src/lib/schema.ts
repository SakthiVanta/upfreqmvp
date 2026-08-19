import { pgTable, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

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

// 4. Analyzed Repositories Cache & AST Storage
export const analyzedRepositories = pgTable('analyzed_repositories', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'cascade' }),
  repoUrl: text('repo_url').notNull(),
  repoName: varchar('repo_name', { length: 255 }).notNull(),
  rosDistribution: varchar('ros_distribution', { length: 50 }).default('humble'),
  urdfAstJson: text('urdf_ast_json'),
  nav2ConfigJson: text('nav2_config_json'),
  gazeboPluginsJson: text('gazebo_plugins_json'),
  isaacTestsJson: text('isaac_tests_json'),
  persistedAt: timestamp('persisted_at').defaultNow().notNull(),
});

// 5. Saved Parametric Studio Profiles Table
export const parametricProfiles = pgTable('parametric_profiles', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).references(() => projects.id, { onDelete: 'cascade' }),
  profileName: varchar('profile_name', { length: 255 }).notNull(),
  paramsJson: text('params_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
