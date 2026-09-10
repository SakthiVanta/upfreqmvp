import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';

export interface WorkspaceRegistrationRecord {
  id: string;
  projectId: string;
  machineId: string;
  localPath: string;
  lastSeenAt: string;
  createdAt: string;
}

function toRecord(row: typeof schema.workspaceRegistrations.$inferSelect): WorkspaceRegistrationRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    machineId: row.machineId,
    localPath: row.localPath,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getWorkspacePath(userId: string, projectId: string, machineId: string): Promise<WorkspaceRegistrationRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(schema.workspaceRegistrations)
    .where(and(
      eq(schema.workspaceRegistrations.userId, userId),
      eq(schema.workspaceRegistrations.projectId, projectId),
      eq(schema.workspaceRegistrations.machineId, machineId),
    ));

  return row ? toRecord(row) : null;
}

export async function registerWorkspacePath(userId: string, projectId: string, machineId: string, localPath: string): Promise<WorkspaceRegistrationRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  // The unique index this upsert conflicts on is (projectId, machineId),
  // not (userId, projectId, machineId) — since a project has exactly one
  // owner, that's fine IF projectId is verified to belong to userId first.
  // Without this check, any authenticated caller could pass someone else's
  // projectId and either plant a new registration against it or, worse,
  // collide with and silently overwrite the real owner's existing
  // localPath/lastSeenAt via onConflictDoUpdate.
  const [owned] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
  if (!owned) throw new Error('Project not found.');

  const id = `wsr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await db
    .insert(schema.workspaceRegistrations)
    .values({ id, userId, projectId, machineId, localPath })
    .onConflictDoUpdate({
      target: [schema.workspaceRegistrations.projectId, schema.workspaceRegistrations.machineId],
      set: { localPath, lastSeenAt: new Date() },
    })
    .returning();

  return toRecord(row);
}

export async function listWorkspaces(userId: string, projectId?: string): Promise<WorkspaceRegistrationRecord[]> {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(schema.workspaceRegistrations.userId, userId)];
  if (projectId) conditions.push(eq(schema.workspaceRegistrations.projectId, projectId));

  const rows = await db
    .select()
    .from(schema.workspaceRegistrations)
    .where(and(...conditions))
    .orderBy(desc(schema.workspaceRegistrations.lastSeenAt));

  return rows.map(toRecord);
}
