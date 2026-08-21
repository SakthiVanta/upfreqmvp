import { NextRequest } from 'next/server';
import { addMeshFile } from '@/lib/db/robot-designs';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

// Called by the browser right after a client-direct blob upload (see
// files/client-upload/route.ts) finishes, to persist the resulting blob's
// URL/pathname as a mesh file row. Separate from token generation because
// the upload itself happens browser-to-blob-storage directly, bypassing
// this server entirely — this is just the follow-up bookkeeping call.
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();

    const url = typeof body.url === 'string' ? body.url : '';
    const pathname = typeof body.pathname === 'string' ? body.pathname : '';
    if (!url || !pathname) {
      return Response.json({ error: 'url and pathname are required' }, { status: 400 });
    }

    const record = await addMeshFile(id, {
      url,
      pathname,
      originalFilename: typeof body.originalFilename === 'string' ? body.originalFilename : pathname,
      extension: typeof body.extension === 'string' ? body.extension : pathname.split('.').pop() || '',
      sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : 0,
    });

    return Response.json(record, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
