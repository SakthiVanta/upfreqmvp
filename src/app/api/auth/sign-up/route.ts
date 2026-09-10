import { redirect } from 'next/navigation';
import { getSignUpUrl } from '@workos-inc/authkit-nextjs';

export const runtime = 'nodejs';

// See src/app/api/auth/sign-in/route.ts for why this has to be a route
// handler rather than a direct call from the login page.
export async function GET() {
  redirect(await getSignUpUrl());
}
