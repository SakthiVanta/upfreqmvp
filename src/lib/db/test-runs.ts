import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';

export interface TestRunRecord {
  id: string;
  userId: string;
  projectId?: string | null;
  targetType: string;
  repoUrl?: string | null;
  branch: string;
  commitSha?: string | null;
  commitMessage?: string | null;
  environment: string;
  serverUrl?: string | null;
  testCaseId: string;
  testCaseName: string;
  category: string;
  status: 'passed' | 'failed' | 'error';
  metrics: Record<string, number>;
  assertions: Array<{
    id: string;
    label: string;
    metric: string;
    operator: string;
    targetValue: number;
    actualValue: number;
    passed: boolean;
    unit?: string;
  }>;
  logs: string[];
  durationMs: number;
  createdAt: string;
}

export interface SaveTestRunInput {
  id?: string;
  projectId?: string;
  targetType?: string;
  repoUrl?: string;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  environment?: string;
  serverUrl?: string;
  testCaseId: string;
  testCaseName: string;
  category: string;
  status: 'passed' | 'failed' | 'error';
  metricsJson?: Record<string, number>;
  assertionsJson?: any[];
  logsJson?: string[];
  durationMs?: number;
}

function toRecord(row: typeof schema.testRuns.$inferSelect): TestRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    targetType: row.targetType,
    repoUrl: row.repoUrl,
    branch: row.branch,
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    environment: row.environment,
    serverUrl: row.serverUrl,
    testCaseId: row.testCaseId,
    testCaseName: row.testCaseName,
    category: row.category,
    status: row.status as 'passed' | 'failed' | 'error',
    metrics: (row.metricsJson as Record<string, number>) || {},
    assertions: (row.assertionsJson as any[]) || [],
    logs: (row.logsJson as string[]) || [],
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveTestRun(userId: string, input: SaveTestRunInput): Promise<TestRunRecord | null> {
  const db = getDb();
  if (!db) return null;

  // As with saveMcpRobot: an unowned projectId is dropped, not rejected —
  // the run itself is still recorded, just not attached to a project that
  // isn't the caller's. Defense-in-depth against a foreign projectId
  // otherwise FK-referencing another user's project row.
  let projectId = input.projectId || null;
  if (projectId) {
    const [owned] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
    if (!owned) projectId = null;
  }

  const runId = input.id || `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const values = {
    id: runId,
    userId,
    projectId,
    targetType: input.targetType || 'project',
    repoUrl: input.repoUrl || null,
    branch: input.branch || 'main',
    commitSha: input.commitSha || null,
    commitMessage: input.commitMessage || null,
    environment: input.environment || 'grid',
    serverUrl: input.serverUrl || null,
    testCaseId: input.testCaseId,
    testCaseName: input.testCaseName,
    category: input.category,
    status: input.status,
    metricsJson: input.metricsJson || {},
    assertionsJson: input.assertionsJson || [],
    logsJson: input.logsJson || [],
    durationMs: input.durationMs || 0,
  };

  const [row] = await db.insert(schema.testRuns).values(values).returning();
  if (!row) return null;

  return toRecord(row);
}

export async function getTestRun(userId: string, id: string): Promise<TestRunRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(schema.testRuns)
    .where(and(eq(schema.testRuns.id, id), eq(schema.testRuns.userId, userId)));

  return row ? toRecord(row) : null;
}

export async function listTestRuns(userId: string, filters?: {
  projectId?: string;
  repoUrl?: string;
  branch?: string;
  limit?: number;
}): Promise<TestRunRecord[]> {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(schema.testRuns.userId, userId)];
  if (filters?.projectId) {
    conditions.push(eq(schema.testRuns.projectId, filters.projectId));
  }
  if (filters?.repoUrl) {
    conditions.push(eq(schema.testRuns.repoUrl, filters.repoUrl));
  }
  if (filters?.branch) {
    conditions.push(eq(schema.testRuns.branch, filters.branch));
  }

  const rows = await db
    .select()
    .from(schema.testRuns)
    .where(and(...conditions))
    .orderBy(desc(schema.testRuns.createdAt))
    .limit(filters?.limit || 50);

  return rows.map(toRecord);
}
