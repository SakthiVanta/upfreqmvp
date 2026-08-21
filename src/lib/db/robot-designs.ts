import { and, desc, eq } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { RobotLink, RobotJoint } from '../urdf/types';

export interface MeshFileRecord {
  id: string;
  designId: string;
  url: string;
  originalFilename: string;
  extension: string;
  sizeBytes: number;
}

export interface RobotDesignRecord {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  links: RobotLink[];
  joints: RobotJoint[];
  urdfXml: string | null;
  status: 'draft' | 'exported';
  meshFiles: MeshFileRecord[];
}

export interface RobotDesignUpdateInput {
  name?: string;
  description?: string;
  links?: RobotLink[];
  joints?: RobotJoint[];
  urdfXml?: string;
  status?: 'draft' | 'exported';
}

type Db = NonNullable<ReturnType<typeof getDb>>;

function toMeshFileRecord(row: typeof schema.robotDesignMeshFiles.$inferSelect): MeshFileRecord {
  return {
    id: row.id,
    designId: row.designId,
    url: row.blobUrl,
    originalFilename: row.originalFilename,
    extension: row.extension,
    sizeBytes: row.sizeBytes,
  };
}

function toRecord(
  d: typeof schema.robotDesigns.$inferSelect,
  meshFileRows: (typeof schema.robotDesignMeshFiles.$inferSelect)[]
): RobotDesignRecord {
  return {
    id: d.id,
    name: d.name,
    description: d.description || '',
    projectId: d.projectId,
    links: (d.linksJson as RobotLink[]) || [],
    joints: (d.jointsJson as RobotJoint[]) || [],
    urdfXml: d.urdfXml,
    status: (d.status as 'draft' | 'exported') || 'draft',
    meshFiles: meshFileRows.filter(r => r.designId === d.id).map(toMeshFileRecord),
  };
}

async function meshFilesForDesign(db: Db, designId: string) {
  return db.select().from(schema.robotDesignMeshFiles).where(eq(schema.robotDesignMeshFiles.designId, designId));
}

export async function listRobotDesigns(): Promise<RobotDesignRecord[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(schema.robotDesigns)
    .where(eq(schema.robotDesigns.userId, DEMO_USER_ID))
    .orderBy(desc(schema.robotDesigns.updatedAt));

  if (rows.length === 0) return [];

  const meshFileRows = await db
    .select()
    .from(schema.robotDesignMeshFiles)
    .where(eq(schema.robotDesignMeshFiles.userId, DEMO_USER_ID));

  return rows.map(d => toRecord(d, meshFileRows));
}

export async function getRobotDesign(designId: string): Promise<RobotDesignRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [d] = await db
    .select()
    .from(schema.robotDesigns)
    .where(and(eq(schema.robotDesigns.id, designId), eq(schema.robotDesigns.userId, DEMO_USER_ID)));
  if (!d) return null;

  const meshFileRows = await meshFilesForDesign(db, designId);
  return toRecord(d, meshFileRows);
}

export async function createRobotDesign(input: { name: string; description?: string; projectId?: string }): Promise<RobotDesignRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  const id = `rd_${crypto.randomUUID()}`;
  const name = input.name.trim();
  const description = input.description?.trim() || '';

  await db.insert(schema.robotDesigns).values({
    id,
    userId: DEMO_USER_ID,
    projectId: input.projectId || null,
    name,
    description,
  });

  return { id, name, description, projectId: input.projectId || null, links: [], joints: [], urdfXml: null, status: 'draft', meshFiles: [] };
}

export async function updateRobotDesign(designId: string, input: RobotDesignUpdateInput): Promise<RobotDesignRecord | null> {
  const db = getDb();
  if (!db) return null;

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) setValues.name = input.name.trim();
  if (input.description !== undefined) setValues.description = input.description.trim();
  if (input.links !== undefined) setValues.linksJson = input.links;
  if (input.joints !== undefined) setValues.jointsJson = input.joints;
  if (input.urdfXml !== undefined) setValues.urdfXml = input.urdfXml;
  if (input.status !== undefined) setValues.status = input.status;

  await db
    .update(schema.robotDesigns)
    .set(setValues)
    .where(and(eq(schema.robotDesigns.id, designId), eq(schema.robotDesigns.userId, DEMO_USER_ID)));

  return getRobotDesign(designId);
}

export async function deleteRobotDesign(designId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const meshFileRows = await meshFilesForDesign(db, designId);
  await Promise.all(meshFileRows.map(row => del(row.blobPathname).catch(() => undefined)));

  await db.delete(schema.robotDesigns).where(and(eq(schema.robotDesigns.id, designId), eq(schema.robotDesigns.userId, DEMO_USER_ID)));
}

export async function addMeshFile(
  designId: string,
  input: { url: string; pathname: string; originalFilename: string; extension: string; sizeBytes: number }
): Promise<MeshFileRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  const id = `mf_${crypto.randomUUID()}`;
  await db.insert(schema.robotDesignMeshFiles).values({
    id,
    designId,
    userId: DEMO_USER_ID,
    blobUrl: input.url,
    blobPathname: input.pathname,
    originalFilename: input.originalFilename,
    extension: input.extension,
    sizeBytes: input.sizeBytes,
  });

  return { id, designId, url: input.url, originalFilename: input.originalFilename, extension: input.extension, sizeBytes: input.sizeBytes };
}

export async function deleteMeshFile(fileId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const [row] = await db
    .select()
    .from(schema.robotDesignMeshFiles)
    .where(and(eq(schema.robotDesignMeshFiles.id, fileId), eq(schema.robotDesignMeshFiles.userId, DEMO_USER_ID)));
  if (!row) return;

  await del(row.blobPathname).catch(() => undefined);
  await db.delete(schema.robotDesignMeshFiles).where(eq(schema.robotDesignMeshFiles.id, fileId));
}
