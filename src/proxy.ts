import { authkitProxy } from '@workos-inc/authkit-nextjs';

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime semantics,
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
//
// This gates every page/app-API route behind a signed-in WorkOS session,
// redirecting unauthenticated visits to the AuthKit hosted sign-in — the
// replacement for app-layout.tsx's old client-side `isAuthenticated` check.
//
// `/api/mcp`, `/api/billing/webhook`, and `/.well-known/*` are excluded on
// purpose: each is called by a non-browser caller with no WorkOS session
// cookie (an MCP agent's Bearer JWT, verified in src/lib/auth/mcp-auth.ts;
// Razorpay's own server, verified via X-Razorpay-Signature in
// src/lib/billing/razorpay.ts). Running this proxy on any of them would
// incorrectly try to redirect their JSON POST to an HTML sign-in page
// instead of letting the route's own auth check return a proper response.
export const proxy = authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/login', '/api/auth/callback', '/api/auth/sign-in', '/api/auth/sign-up'],
  },
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/mcp|api/billing/webhook|\\.well-known).*)'],
};
