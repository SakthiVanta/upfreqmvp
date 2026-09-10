import 'server-only';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getWorkOS } from '@workos-inc/authkit-nextjs';
import { upsertUserFromWorkos } from './user-sync';

// WorkOS's dedicated AuthKit domain acts as the OAuth 2.1 authorization
// server for MCP — a distinct surface from the Management-API-based
// getJwksUrl()/session-cookie flow the rest of the app uses (see
// src/lib/auth/session.ts). Per WorkOS's own docs, MCP access tokens are
// verified against `${WORKOS_AUTHKIT_DOMAIN}/oauth2/jwks`, with both
// `issuer` and `audience` set to values registered in the WorkOS Dashboard.
const AUTHKIT_DOMAIN = process.env.WORKOS_AUTHKIT_DOMAIN;
const JWKS = AUTHKIT_DOMAIN ? createRemoteJWKSet(new URL(`${AUTHKIT_DOMAIN}/oauth2/jwks`)) : null;

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// The resource identifier this server presents as its MCP endpoint — must
// exactly match whatever "resource" the user registered for this app in the
// WorkOS Dashboard, since that's what WorkOS stamps into the `aud` claim.
export function mcpResourceUrl(): string {
  return `${appBaseUrl()}/api/mcp`;
}

// RFC 9728 discovery document URL — sent back in the WWW-Authenticate header
// of a 401 so MCP clients (Claude/ChatGPT/Cursor/Codex) know where to look
// for how to obtain a token, per src/app/.well-known/oauth-protected-resource/route.ts.
export function oauthProtectedResourceMetadataUrl(): string {
  return `${appBaseUrl()}/.well-known/oauth-protected-resource`;
}

// Fetching the full WorkOS user (for email/name) on every single MCP tool
// call would mean one extra WorkOS Management API round-trip per call — this
// short, process-local cache avoids that for a rapid burst of tool calls in
// one session. Worst case (cold start, multiple instances) is just an extra
// upsert, which is idempotent and cheap.
const recentlyUpserted = new Map<string, number>();
const UPSERT_CACHE_MS = 60_000;

export async function verifyMcpBearerToken(req: Request): Promise<{ userId: string } | null> {
  if (!JWKS) return null; // WORKOS_AUTHKIT_DOMAIN not configured yet

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  let sub: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTHKIT_DOMAIN,
      audience: mcpResourceUrl(),
    });
    if (!payload.sub) return null;
    sub = payload.sub;
  } catch {
    return null;
  }

  const lastUpserted = recentlyUpserted.get(sub);
  if (!lastUpserted || Date.now() - lastUpserted > UPSERT_CACHE_MS) {
    const user = await getWorkOS().userManagement.getUser(sub);
    await upsertUserFromWorkos(user);
    recentlyUpserted.set(sub, Date.now());
  }

  return { userId: sub };
}
