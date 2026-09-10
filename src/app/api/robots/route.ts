import { NextRequest } from 'next/server';
import { listMcpRobots } from '@/lib/db/mcp-robots';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    const robots = await listMcpRobots(userId, projectId);
    return Response.json(robots);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
