import { NextRequest } from 'next/server';
import { resetDatabaseAndSeedDemoUser } from '@/lib/db/admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const result = await resetDatabaseAndSeedDemoUser();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
