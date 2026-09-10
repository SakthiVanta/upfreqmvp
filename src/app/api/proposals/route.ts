import { NextRequest } from 'next/server';
import { listProposals, getProposal, resolveProposal } from '@/lib/agent-native/policy-engine';
import { registry } from '@/lib/agent-native/registry';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const proposals = await listProposals(userId);
    return Response.json({
      count: proposals.length,
      proposals,
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await req.json();
    const { proposalId, approved } = body;

    if (!proposalId) {
      return Response.json({ error: 'Missing proposalId.' }, { status: 400 });
    }

    const proposal = await getProposal(userId, proposalId);
    if (!proposal) {
      return Response.json({ error: 'Proposal not found.' }, { status: 404 });
    }

    const action = registry.findByNamespaceAndName(proposal.actionNamespace, proposal.actionName);
    if (!action) {
      return Response.json({ error: `Action "${proposal.actionNamespace}.${proposal.actionName}" no longer exists in the registry.` }, { status: 409 });
    }

    const res = await resolveProposal(userId, proposalId, !!approved, async () => {
      // Execute the action now that human approved it
      const actionResult = await registry.execute(action.id, proposal.input, {
        source: 'ui',
        userId,
        autoApprove: true,
      });
      return actionResult.data;
    });

    return Response.json(res);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message || 'Proposal resolution failed.' }, { status: 500 });
  }
}
