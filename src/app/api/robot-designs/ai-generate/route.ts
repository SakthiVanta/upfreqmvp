import { NextRequest } from 'next/server';
import { getAgentSettings } from '@/lib/db/settings';
import { resolveApiKey } from '@/lib/db/api-keys';
import { generateTopology, generateBlueprint, TopologyComponent } from '@/lib/agent/topology';
import { PROVIDERS } from '@/lib/agent/types';

export const runtime = 'nodejs';

// Not scoped under a design id — this only reasons about component
// geometry or a text description, it never touches the database.
// Persistence happens separately once the user reviews and confirms.
//
// Two modes, dispatched on whether any components were measured:
// - components present: generateTopology (real geometry, see topology.ts)
// - components empty: generateBlueprint (text-only skeleton for a design
//   that has no uploaded links yet — description becomes mandatory here,
//   since there's nothing else for the model to reason from)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const components: TopologyComponent[] = Array.isArray(body.components) ? body.components : [];
    const userContext = typeof body.userContext === 'string' && body.userContext.trim() ? body.userContext.trim().slice(0, 2000) : undefined;

    if (components.length === 0 && !userContext) {
      return Response.json({ error: 'Describe the robot you want first — with no links uploaded yet, that description is all AI has to work from.' }, { status: 400 });
    }

    const settings = await getAgentSettings();
    const apiKey = await resolveApiKey(settings.provider);
    if (!apiKey) {
      const label = PROVIDERS.find((p) => p.id === settings.provider)?.label || settings.provider;
      return Response.json({ error: `No API key configured for ${label}. Add one on the Settings page.` }, { status: 400 });
    }

    if (components.length === 0) {
      const blueprint = await generateBlueprint(settings, apiKey, userContext!);
      return Response.json({ mode: 'blueprint', blueprint });
    }

    const suggestion = await generateTopology(settings, apiKey, components, userContext);
    return Response.json({ mode: 'topology', suggestion });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
