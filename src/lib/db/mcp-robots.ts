import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';

export interface McpRobotChassis {
  length?: number;
  width?: number;
  height?: number;
  massKg?: number;
  inertia?: { ixx: number; iyy: number; izz: number };
}

export interface McpRobotRecord {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  description: string;
  driveType: string | null;
  chassis: McpRobotChassis;
  sensors: string[];
  urdfXacroXml: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMcpRobotInput {
  projectId?: string | null;
  name: string;
  description?: string;
  driveType?: string;
  chassis?: McpRobotChassis;
  sensors?: string[];
  urdfXacroXml?: string;
}

function toRecord(row: typeof schema.mcpRobots.$inferSelect): McpRobotRecord {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    name: row.name,
    description: row.description || '',
    driveType: row.driveType,
    chassis: (row.chassisJson as McpRobotChassis) || {},
    sensors: (row.sensorsJson as string[]) || [],
    urdfXacroXml: row.urdfXacroXml,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveMcpRobot(userId: string, input: SaveMcpRobotInput): Promise<McpRobotRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  // A projectId the caller doesn't own is silently dropped rather than
  // rejected — save_robot's projectId is optional (a robot can be saved
  // unattached), so an unowned id just means "not attached to a project"
  // instead of failing the whole save. Prevents planting a robot row that
  // FKs to another user's project (referential pollution — harmless today
  // since reads are userId-scoped, but a defense-in-depth measure against a
  // future feature joining this table by projectId alone).
  let projectId = input.projectId || null;
  if (projectId) {
    const [owned] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
    if (!owned) projectId = null;
  }

  const id = `mrb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await db
    .insert(schema.mcpRobots)
    .values({
      id,
      userId,
      projectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      driveType: input.driveType || null,
      chassisJson: input.chassis || {},
      sensorsJson: input.sensors || [],
      urdfXacroXml: input.urdfXacroXml || null,
    })
    .returning();

  return toRecord(row);
}

export async function listMcpRobots(userId: string, projectId?: string): Promise<McpRobotRecord[]> {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(schema.mcpRobots.userId, userId)];
  if (projectId) conditions.push(eq(schema.mcpRobots.projectId, projectId));

  const rows = await db
    .select()
    .from(schema.mcpRobots)
    .where(and(...conditions))
    .orderBy(desc(schema.mcpRobots.createdAt));

  return rows.map(toRecord);
}

export async function getMcpRobot(userId: string, id: string): Promise<McpRobotRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(schema.mcpRobots)
    .where(and(eq(schema.mcpRobots.id, id), eq(schema.mcpRobots.userId, userId)));

  return row ? toRecord(row) : null;
}
