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
