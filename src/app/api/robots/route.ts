import { listRobotsForUser } from '@/lib/neon-db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const robots = await listRobotsForUser();
    return Response.json({ robots });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
