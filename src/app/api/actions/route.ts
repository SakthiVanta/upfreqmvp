import { NextRequest } from 'next/server';
import { registry } from '@/lib/agent-native/registry';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';
import { checkAndIncrementWebappUsage } from '@/lib/billing/usage';

export const runtime = 'nodejs';

export async function GET() {
  const descriptors = registry.listDescriptors();
  return Response.json({
    count: descriptors.length,
    actions: descriptors,
  });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await req.json();
    const { actionId, input, autoApprove, projectId } = body;

    if (!actionId) {
      return Response.json({ error: 'Missing actionId parameter.' }, { status: 400 });
    }

    // Separate counter from the MCP gateway's — this route (registry.execute
    // with source:'api') used to bypass metering entirely, letting an
    // authenticated browser session run unlimited compute-expensive actions
    // (e.g. a real ~20s CAD compile) with no cap at all.
    const usage = await checkAndIncrementWebappUsage(userId);
    if (!usage.allowed) {
      return Response.json({
        error: `Monthly free-tier action limit reached (${usage.callsThisMonth - 1}/${usage.limit} used this month). Upgrade to Pro in Settings for unlimited actions.`,
      }, { status: 429 });
    }

    const result = await registry.execute(actionId, input || {}, {
      source: 'api',
      userId,
      autoApprove: !!autoApprove,
      projectId,
    });

    return Response.json(result);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message || 'Action dispatch failed.' }, { status: 500 });
  }
}
