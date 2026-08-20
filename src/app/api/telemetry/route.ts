import { listRecentAuditRuns } from '@/lib/db/audit-runs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const runs = await listRecentAuditRuns(10);
    return Response.json({ runs });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
