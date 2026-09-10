import { NextRequest } from 'next/server';
import { registry } from '@/lib/agent-native/registry';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

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
