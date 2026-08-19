import { NextRequest } from 'next/server';
import { deleteRobot } from '@/lib/neon-db';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await deleteRobot(id);
    return Response.json({ success: ok });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
