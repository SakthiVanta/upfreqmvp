import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';
import { CadNode } from '../cad/scad-generator';
import { MeshMassProperties } from '../cad/mesh-mass-properties';

export interface CadPartRecord {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  description: string;
  nodeTree: CadNode;
  scadSource: string;
  stlUrl: string | null;
  massProperties: MeshMassProperties | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCadPartInput {
  id?: string;
  projectId?: string | null;
  name: string;
  description?: string;
  nodeTree: CadNode;
  scadSource: string;
  stlUrl?: string | null;
  massProperties?: MeshMassProperties | null;
}

function toRecord(row: typeof schema.cadParts.$inferSelect): CadPartRecord {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    name: row.name,
    description: row.description || '',
    nodeTree: row.nodeTreeJson as CadNode,
    scadSource: row.scadSource,
    stlUrl: row.stlUrl,
    massProperties: (row.massPropertiesJson as MeshMassProperties) || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveCadPart(userId: string, input: SaveCadPartInput): Promise<CadPartRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  // Same defense-in-depth as saveMcpRobot: an unowned projectId is silently
  // dropped (the part still saves, just unattached) rather than rejected.
  let projectId = input.projectId || null;
  if (projectId) {
    const [owned] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
    if (!owned) projectId = null;
  }

  const id = input.id || `cad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const values = {
    id,
    userId,
    projectId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    nodeTreeJson: input.nodeTree,
    scadSource: input.scadSource,
    stlUrl: input.stlUrl || null,
    massPropertiesJson: input.massProperties || null,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(schema.cadParts)
    .values(values)
    .onConflictDoUpdate({ target: schema.cadParts.id, set: values })
    .returning();

  return toRecord(row);
}

export async function listCadParts(userId: string, projectId?: string): Promise<CadPartRecord[]> {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(schema.cadParts.userId, userId)];
  if (projectId) conditions.push(eq(schema.cadParts.projectId, projectId));

  const rows = await db
    .select()
    .from(schema.cadParts)
    .where(and(...conditions))
    .orderBy(desc(schema.cadParts.createdAt));

  return rows.map(toRecord);
}

export async function getCadPart(userId: string, id: string): Promise<CadPartRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(schema.cadParts)
    .where(and(eq(schema.cadParts.id, id), eq(schema.cadParts.userId, userId)));

  return row ? toRecord(row) : null;
}
