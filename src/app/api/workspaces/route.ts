import { NextRequest } from 'next/server';
import { listWorkspaces } from '@/lib/db/workspace-registrations';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    const workspaces = await listWorkspaces(userId, projectId);
    return Response.json(workspaces);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
