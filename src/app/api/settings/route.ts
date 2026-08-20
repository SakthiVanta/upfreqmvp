import { NextRequest } from 'next/server';
import { getAgentSettings, updateAgentSettings } from '@/lib/db/settings';
import { listProviderModels } from '@/lib/db/provider-models';
import { getProviderKeyStatuses } from '@/lib/db/api-keys';
import { PROVIDERS, ProviderId } from '@/lib/agent/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [settings, models, configured] = await Promise.all([
      getAgentSettings(),
      listProviderModels(),
      getProviderKeyStatuses(),
    ]);
    return Response.json({ settings, configured, models });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = body.provider as ProviderId;
    const model = typeof body.model === 'string' ? body.model.trim() : '';

    if (!PROVIDERS.some(p => p.id === provider)) {
      return Response.json({ error: `Unknown provider: ${body.provider}` }, { status: 400 });
    }
    if (!model) {
      return Response.json({ error: 'model is required' }, { status: 400 });
    }

    const [settings, models, configured] = await Promise.all([
      updateAgentSettings({ provider, model }),
      listProviderModels(),
      getProviderKeyStatuses(),
    ]);
    return Response.json({ settings, configured, models });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
