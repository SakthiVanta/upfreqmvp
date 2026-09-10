import { NextRequest } from 'next/server';
import { compilePreflight } from '@/lib/compiler/preflight-compiler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urdfContent, robotName, enableVhacd, targetEngine } = body;

    if (!urdfContent || typeof urdfContent !== 'string') {
      return Response.json({ error: 'Missing urdfContent string in request body.' }, { status: 400 });
    }

    const result = compilePreflight(urdfContent, {
      robotName,
      enableVhacdDecomposition: enableVhacd ?? true,
      targetEngine: targetEngine || 'both',
      replaceHardwareInterface: true,
    });

    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: err.message || 'Preflight compilation failed.' }, { status: 500 });
  }
}
