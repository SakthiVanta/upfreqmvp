import { NextRequest } from 'next/server';
import { handleMcpRequest } from '@/lib/agent-native/mcp-gateway';
import { verifyMcpBearerToken, oauthProtectedResourceMetadataUrl } from '@/lib/auth/mcp-auth';
import { registry } from '@/lib/agent-native/registry';

export const runtime = 'nodejs';

function unauthorized() {
  return new Response(
    JSON.stringify({ error: 'unauthorized', error_description: 'A valid WorkOS-issued bearer token is required.' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        // RFC 9728 — tells the MCP client (Claude/ChatGPT/Cursor/Codex)
        // where to discover the authorization server and get a token.
        'WWW-Authenticate': `Bearer resource_metadata="${oauthProtectedResourceMetadataUrl()}"`,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const auth = await verifyMcpBearerToken(req);
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const response = await handleMcpRequest(body, auth.userId);
    return Response.json(response);
  } catch (err: any) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: err.message || 'Parse error' } },
      { status: 400 }
    );
  }
}

// Deliberately unauthenticated — this is non-sensitive server metadata
// (name/version/tool count), not user data, and it's what the Settings
// page's "Test Connection" ping hits: POSTing tools/list here would need
// the same WorkOS bearer token a real MCP client presents, which the
// browser's own session cookie can't provide, so that ping would always
// 401. GET stays open so the ping (and anyone else) can confirm the
// gateway itself is up without needing OAuth just to check that.
export async function GET() {
  return Response.json({
    name: 'upfreq-robotics-mcp',
    version: '3.4.0',
    description: 'UpFreq Robotics Orchestration & Dual Simulation MCP Gateway',
    protocol: 'mcp-jsonrpc-2.0',
    endpoints: {
      post: '/api/mcp',
    },
    authorization: {
      type: 'oauth2.1',
      protectedResourceMetadata: oauthProtectedResourceMetadataUrl(),
    },
    toolCount: registry.list().length,
  });
}
