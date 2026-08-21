import { NextRequest } from 'next/server';
import { deleteMeshFile } from '@/lib/db/robot-designs';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { fileId } = await params;
    await deleteMeshFile(fileId);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
