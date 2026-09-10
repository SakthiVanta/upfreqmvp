import { NextRequest } from 'next/server';
import { resetUserWorkspaceData } from '@/lib/db/admin';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const result = await resetUserWorkspaceData(userId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
