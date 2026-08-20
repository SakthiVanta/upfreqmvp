import { desc, eq } from 'drizzle-orm';
import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { AgentTokenUsage, ProviderId } from '../agent/types';

export interface AuditRunInput {
  projectId: string | null;
  repoUrl: string;
  provider: ProviderId;
  model: string;
  usedAgenticAnalysis: boolean;
  toolCallCount: number | null;
  usage: AgentTokenUsage | null;
  durationMs: number;
  errorMessage: string | null;
}

/** Fire-and-forget from the caller's perspective — telemetry should never
 * be able to fail an audit that otherwise succeeded, so this swallows its
 * own errors rather than throwing. */
export async function recordAuditRun(input: AuditRunInput): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.insert(schema.auditRuns).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: DEMO_USER_ID,
      projectId: input.projectId,
      repoUrl: input.repoUrl,
      provider: input.provider,
      model: input.model,
      usedAgenticAnalysis: input.usedAgenticAnalysis,
      toolCallCount: input.toolCallCount,
      apiCallCount: input.usage?.apiCallCount ?? null,
      inputTokens: input.usage?.inputTokens ?? null,
      cachedInputTokens: input.usage?.cachedInputTokens ?? null,
      outputTokens: input.usage?.outputTokens ?? null,
      totalTokens: input.usage?.totalTokens ?? null,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage,
    });
  } catch (err: any) {
    console.error(`[AUDIT TELEMETRY ERROR] Failed to record audit run: ${err.message}`);
  }
}

export interface AuditRunRecord {
  id: string;
  repoUrl: string;
  provider: string;
  model: string;
  usedAgenticAnalysis: boolean;
  toolCallCount: number | null;
  apiCallCount: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function listRecentAuditRuns(limit = 10): Promise<AuditRunRecord[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(schema.auditRuns)
    .where(eq(schema.auditRuns.userId, DEMO_USER_ID))
    .orderBy(desc(schema.auditRuns.createdAt))
    .limit(limit);

  return rows.map(r => ({
    id: r.id,
    repoUrl: r.repoUrl,
    provider: r.provider,
    model: r.model,
    usedAgenticAnalysis: r.usedAgenticAnalysis,
    toolCallCount: r.toolCallCount,
    apiCallCount: r.apiCallCount,
    inputTokens: r.inputTokens,
    cachedInputTokens: r.cachedInputTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    durationMs: r.durationMs,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));
}
