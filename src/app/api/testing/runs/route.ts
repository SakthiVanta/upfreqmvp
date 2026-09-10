import { NextRequest } from 'next/server';
import { listTestRuns, saveTestRun, SaveTestRunInput } from '@/lib/db/test-runs';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;
    const repoUrl = searchParams.get('repoUrl') || undefined;
    const branch = searchParams.get('branch') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    const runs = await listTestRuns(userId, { projectId, repoUrl, branch, limit });
    return new Response(JSON.stringify(runs), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to list test runs' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body: SaveTestRunInput = await req.json();
    if (!body.testCaseId || !body.testCaseName || !body.status) {
      return new Response(
        JSON.stringify({ error: 'Missing required test run fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await saveTestRun(userId, body);
    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to save test run' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
