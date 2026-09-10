import { NextRequest } from 'next/server';
import { listBridgeEndpoints, registerBridgeEndpoint, BridgeEndpointType } from '@/lib/db/bridge-endpoints';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';
import { assertPublicHttpUrl } from '@/lib/agent-native/actions/bridge-http';

export const runtime = 'nodejs';

const VALID_ENDPOINT_TYPES: BridgeEndpointType[] = ['isaac_sim', 'foxglove', 'zenoh'];

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    const endpoints = await listBridgeEndpoints(userId, projectId);
    // apiKey is a credential for the user's own external service — no
    // reason to ship it to the browser just to render a read-only list.
    const safeEndpoints = endpoints.map(({ apiKey, ...rest }) => rest);
    return Response.json(safeEndpoints);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Lets a user register a bridge endpoint directly from the webapp (Settings
// / project page), not only by asking Claude to do it over MCP — same
// underlying registerBridgeEndpoint() call either path takes.
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await req.json();
    const { projectId, machineId, endpointType, url, apiKey } = body;

    if (typeof projectId !== 'string' || !projectId) {
      return Response.json({ error: 'Missing projectId.' }, { status: 400 });
    }
    if (typeof machineId !== 'string' || !machineId.trim()) {
      return Response.json({ error: 'Missing machineId.' }, { status: 400 });
    }
    if (!VALID_ENDPOINT_TYPES.includes(endpointType)) {
      return Response.json({ error: `endpointType must be one of: ${VALID_ENDPOINT_TYPES.join(', ')}` }, { status: 400 });
    }
    if (typeof url !== 'string' || !url) {
      return Response.json({ error: 'Missing url.' }, { status: 400 });
    }
    // Same guard the MCP register_endpoint action applies — catches a
    // private/unreachable URL immediately instead of only at first use
    // (resolveBridgeServerUrl re-validates then too, but failing fast here
    // gives the person filling out the form immediate feedback).
    await assertPublicHttpUrl(url);

    const endpoint = await registerBridgeEndpoint(userId, projectId, machineId.trim(), endpointType, url, typeof apiKey === 'string' && apiKey ? apiKey : undefined);
    const { apiKey: _omit, ...safeEndpoint } = endpoint;
    return Response.json(safeEndpoint, { status: 201 });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
