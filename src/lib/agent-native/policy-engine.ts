import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as schema from '@/lib/schema';
import { AgentNativeAction, ActionExecutionContext, PolicyLevel } from './types';

export interface PolicyDecision {
  level: PolicyLevel;
  reason?: string;
}

export interface StoredProposal {
  id: string;
  actionNamespace: string;
  actionName: string;
  status: 'pending_review' | 'user_approved' | 'auto_approved' | 'rejected' | 'executed';
  input: any;
  diffPreview: string;
  rationale: string;
  targetFile?: string;
  createdAt: string;
  reviewedAt?: string;
}

function toStoredProposal(row: typeof schema.policyProposals.$inferSelect): StoredProposal {
  return {
    id: row.id,
    actionNamespace: row.actionNamespace,
    actionName: row.actionName,
    status: row.status as StoredProposal['status'],
    input: row.inputPayloadJson,
    diffPreview: row.diffPreview || '',
    rationale: row.rationale || '',
    targetFile: row.targetFile || undefined,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString(),
  };
}

export function evaluateActionPolicy(
  action: AgentNativeAction,
  input: any,
  context: ActionExecutionContext
): PolicyDecision {
  // Source-based auto-approval rules (e.g. human UI click with auto-approve flag)
  if (context.autoApprove && context.source === 'ui') {
    return { level: 'ALLOWED' };
  }

  return {
    level: action.defaultPolicy,
  };
}

// Backed by the `policy_proposals` table (userId-scoped) rather than a
// process-local Map — the in-memory version didn't survive serverless cold
// starts and, worse, was one shared Map across every user's pending
// proposals with no isolation between them at all.
export async function createPolicyProposal(
  action: AgentNativeAction,
  input: any,
  context: ActionExecutionContext
): Promise<StoredProposal> {
  if (!context.userId) {
    throw new Error('A REVIEW-policy action requires an authenticated user.');
  }

  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  let diffPreview = `Action: ${action.id}\nInput: ${JSON.stringify(input, null, 2)}`;
  let rationale = `Agent proposal for ${action.name}`;
  let targetFile: string | undefined;

  if (action.generateProposalDiff) {
    try {
      const p = await action.generateProposalDiff(input);
      diffPreview = p.diff;
      rationale = p.rationale;
      targetFile = p.targetFile;
    } catch {}
  }

  await db.insert(schema.policyProposals).values({
    id: proposalId,
    userId: context.userId,
    projectId: context.projectId || null,
    actionNamespace: action.namespace,
    actionName: action.name,
    policyLevel: action.defaultPolicy,
    status: 'pending_review',
    targetFile: targetFile || null,
    diffPreview,
    rationale,
    inputPayloadJson: input,
  });

  return {
    id: proposalId,
    actionNamespace: action.namespace,
    actionName: action.name,
    status: 'pending_review',
    input,
    diffPreview,
    rationale,
    targetFile,
    createdAt: new Date().toISOString(),
  };
}

export async function getProposal(userId: string, proposalId: string): Promise<StoredProposal | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(schema.policyProposals)
    .where(and(eq(schema.policyProposals.id, proposalId), eq(schema.policyProposals.userId, userId)));

  return row ? toStoredProposal(row) : undefined;
}

export async function listProposals(userId: string): Promise<StoredProposal[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(schema.policyProposals)
    .where(eq(schema.policyProposals.userId, userId))
    .orderBy(desc(schema.policyProposals.createdAt));

  return rows.map(toStoredProposal);
}

export async function resolveProposal(
  userId: string,
  proposalId: string,
  approved: boolean,
  executeFn?: () => Promise<any>
): Promise<{ success: boolean; proposal?: StoredProposal; executionResult?: any; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: 'DATABASE_URL is not configured' };

  const proposal = await getProposal(userId, proposalId);
  if (!proposal) {
    return { success: false, error: 'Proposal not found.' };
  }

  const where = and(eq(schema.policyProposals.id, proposalId), eq(schema.policyProposals.userId, userId));

  if (!approved) {
    await db.update(schema.policyProposals).set({ status: 'rejected', reviewedAt: new Date() }).where(where);
    return { success: true, proposal: { ...proposal, status: 'rejected' } };
  }

  if (!executeFn) {
    await db.update(schema.policyProposals).set({ status: 'user_approved', reviewedAt: new Date() }).where(where);
    return { success: true, proposal: { ...proposal, status: 'user_approved' } };
  }

  try {
    const executionResult = await executeFn();
    await db
      .update(schema.policyProposals)
      .set({ status: 'executed', reviewedAt: new Date(), resultJson: executionResult ?? null })
      .where(where);
    return { success: true, proposal: { ...proposal, status: 'executed' }, executionResult };
  } catch (e: any) {
    await db.update(schema.policyProposals).set({ status: 'user_approved', reviewedAt: new Date() }).where(where);
    return { success: false, proposal: { ...proposal, status: 'user_approved' }, error: e.message };
  }
}
