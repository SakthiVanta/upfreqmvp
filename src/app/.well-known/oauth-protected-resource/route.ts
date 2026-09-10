import { mcpResourceUrl } from '@/lib/auth/mcp-auth';

export const runtime = 'nodejs';

// RFC 9728 OAuth Protected Resource Metadata — tells Claude/ChatGPT/Cursor/
// Codex (or any MCP client) which authorization server to get a token from
// before calling /api/mcp. Excluded from src/proxy.ts's session-cookie gate
// since it must be reachable by non-browser clients with no WorkOS session.
export async function GET() {
  const authkitDomain = process.env.WORKOS_AUTHKIT_DOMAIN;
  if (!authkitDomain) {
    return Response.json({ error: 'WORKOS_AUTHKIT_DOMAIN is not configured on this server.' }, { status: 500 });
  }

  return Response.json({
    resource: mcpResourceUrl(),
    authorization_servers: [authkitDomain],
    bearer_methods_supported: ['header'],
  });
}
