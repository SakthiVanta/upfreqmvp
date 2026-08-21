import { NextRequest } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getRobotDesign } from '@/lib/db/robot-designs';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = ['stl', 'obj', 'glb', 'gltf'];
// Client-direct uploads go straight from the browser to Blob storage, so
// they aren't bound by the ~4.5MB payload limit a Next.js serverless
// function proxying the bytes would hit.
const MAX_BYTES = 200 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const design = await getRobotDesign(id);
        if (!design) throw new Error('Robot design not found');

        const extension = pathname.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          throw new Error(`Unsupported file type ".${extension}" — use .stl, .obj, .glb, or .gltf`);
        }

        return {
          allowedContentTypes: ['model/stl', 'model/obj', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream'],
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({ designId: id }),
        };
      },
      // No onUploadCompleted: that callback is invoked by Vercel's own
      // infrastructure over the public internet, which can't reach a
      // localhost dev server. Instead the DB row is registered by the
      // browser itself right after upload() resolves (see the sibling
      // /register route) — that works identically in dev and production
      // since the browser always awaits the upload directly.
    });

    return Response.json(jsonResponse);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
