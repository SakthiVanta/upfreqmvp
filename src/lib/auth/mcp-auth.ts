import 'server-only';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getWorkOS } from '@workos-inc/authkit-nextjs';
import { upsertUserFromWorkos } from './user-sync';

// WorkOS's dedicated AuthKit domain acts as the OAuth 2.1 authorization
// server for MCP — a distinct surface from the Management-API-based
// getJwksUrl()/session-cookie flow the rest of the app uses (see
// src/lib/auth/session.ts). Per WorkOS's own docs, MCP access tokens are
// verified against `${WORKOS_AUTHKIT_DOMAIN}/oauth2/jwks`.
const AUTHKIT_DOMAIN = process.env.WORKOS_AUTHKIT_DOMAIN;
const JWKS = AUTHKIT_DOMAIN ? createRemoteJWKSet(new URL(`${AUTHKIT_DOMAIN}/oauth2/jwks`)) : null;

// AuthKit doesn't honor RFC 8707 resource indicators — it audiences every
// access token to the environment's WorkOS Client ID (the same one used for
// the browser session-login flow), not to a caller-supplied `resource` URL.
// Confirmed by decoding a real DCR-issued MCP token: its `aud` claim was
// WORKOS_CLIENT_ID, not mcpResourceUrl(). Checking audience against
// mcpResourceUrl() (as an RFC 8707-compliant AS would expect) rejects every
// real token AuthKit issues — verify against WORKOS_CLIENT_ID instead.
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// The resource identifier this server presents as its MCP endpoint in the
// RFC 9728 discovery document (see below) — purely descriptive metadata for
// MCP clients. NOT what tokens are actually audienced to (see the
// WORKOS_CLIENT_ID note above) — don't use this for audience verification.
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
      audience: WORKOS_CLIENT_ID,
    });
    if (!payload.sub) return null;
    sub = payload.sub;
  } catch (err: any) {
    // Swallowing this silently makes a real audience/issuer mismatch
    // indistinguishable from "no token sent" in the logs — log it so a
    // rejected-on-reconnect MCP client is actually diagnosable.
    console.error('[MCP AUTH] Bearer token rejected:', err?.code || err?.name, err?.message);
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
