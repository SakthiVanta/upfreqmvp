import { NextRequest } from 'next/server';
import { saveUserApiKey, deleteUserApiKey } from '@/lib/db/api-keys';
import { PROVIDERS, ProviderId } from '@/lib/agent/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ provider: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { provider } = await params;
    if (!PROVIDERS.some(p => p.id === provider)) {
      return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const body = await req.json();
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
    if (!apiKey.trim()) {
      return Response.json({ error: 'apiKey is required' }, { status: 400 });
    }

    const status = await saveUserApiKey(provider as ProviderId, apiKey);
    return Response.json({ status });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { provider } = await params;
    if (!PROVIDERS.some(p => p.id === provider)) {
      return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    await deleteUserApiKey(provider as ProviderId);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
