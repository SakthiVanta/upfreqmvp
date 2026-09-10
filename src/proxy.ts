import { authkitProxy } from '@workos-inc/authkit-nextjs';

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime semantics,
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
//
// This gates every page/app-API route behind a signed-in WorkOS session,
// redirecting unauthenticated visits to the AuthKit hosted sign-in — the
// replacement for app-layout.tsx's old client-side `isAuthenticated` check.
//
// `/api/mcp` and `/.well-known/*` are excluded on purpose: those are the
// remote MCP resource server, authenticated via a WorkOS-issued Bearer JWT
// verified in src/lib/auth/mcp-auth.ts, not a browser session cookie. Running
// this proxy there would incorrectly try to redirect an agent's JSON-RPC POST
// to an HTML sign-in page instead of returning a 401.
export const proxy = authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/login', '/api/auth/callback', '/api/auth/sign-in', '/api/auth/sign-up'],
  },
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/mcp|\\.well-known).*)'],
};
