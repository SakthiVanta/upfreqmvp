import { NextRequest } from 'next/server';
import { listCadParts } from '@/lib/db/cad-parts';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    const parts = await listCadParts(userId, projectId);
    return Response.json(parts);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
