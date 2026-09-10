import { and, eq, desc } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';

export type BridgeEndpointType = 'isaac_sim' | 'foxglove' | 'zenoh';

export interface BridgeEndpointRecord {
  id: string;
  projectId: string;
  machineId: string;
  endpointType: string;
  url: string;
  apiKey: string | null;
  lastSeenAt: string;
  createdAt: string;
}

function toRecord(row: typeof schema.bridgeEndpoints.$inferSelect): BridgeEndpointRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    machineId: row.machineId,
    endpointType: row.endpointType,
    url: row.url,
    apiKey: row.apiKey,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getBridgeEndpoint(
  userId: string,
  projectId: string,
  machineId: string,
  endpointType: BridgeEndpointType
): Promise<BridgeEndpointRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(schema.bridgeEndpoints)
    .where(and(
      eq(schema.bridgeEndpoints.userId, userId),
      eq(schema.bridgeEndpoints.projectId, projectId),
      eq(schema.bridgeEndpoints.machineId, machineId),
      eq(schema.bridgeEndpoints.endpointType, endpointType),
    ));

  return row ? toRecord(row) : null;
}

export async function registerBridgeEndpoint(
  userId: string,
  projectId: string,
  machineId: string,
  endpointType: BridgeEndpointType,
  url: string,
  apiKey?: string
): Promise<BridgeEndpointRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  // Same ownership check as registerWorkspacePath — the unique index is on
  // (projectId, machineId, endpointType), not userId, so without this an
  // authenticated caller could overwrite another user's registered endpoint
  // for a projectId they don't own.
  const [owned] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
  if (!owned) throw new Error('Project not found.');

  const id = `brg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await db
    .insert(schema.bridgeEndpoints)
    .values({ id, userId, projectId, machineId, endpointType, url, apiKey: apiKey || null })
    .onConflictDoUpdate({
      target: [schema.bridgeEndpoints.projectId, schema.bridgeEndpoints.machineId, schema.bridgeEndpoints.endpointType],
      set: { url, apiKey: apiKey || null, lastSeenAt: new Date() },
    })
    .returning();

  return toRecord(row);
}

export async function listBridgeEndpoints(userId: string, projectId?: string): Promise<BridgeEndpointRecord[]> {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(schema.bridgeEndpoints.userId, userId)];
  if (projectId) conditions.push(eq(schema.bridgeEndpoints.projectId, projectId));

  const rows = await db
    .select()
    .from(schema.bridgeEndpoints)
    .where(and(...conditions))
    .orderBy(desc(schema.bridgeEndpoints.lastSeenAt));

  return rows.map(toRecord);
}
