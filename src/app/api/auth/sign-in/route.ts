import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

export const runtime = 'nodejs';

// getSignInUrl() sets a PKCE verifier cookie as a side effect, which Next.js
// only allows inside a Server Action or Route Handler — not during a plain
// page render (see src/app/login/page.tsx, which links here instead of
// calling getSignInUrl() directly).
export async function GET() {
  redirect(await getSignInUrl());
}
