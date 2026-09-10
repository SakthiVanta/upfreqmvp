import 'server-only';
import { withAuth } from '@workos-inc/authkit-nextjs';

export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'UnauthorizedError';
  }
}

/** The signed-in user's id (= their WorkOS user id, see src/lib/auth/user-sync.ts), or throws UnauthorizedError. */
export async function getSessionUserId(): Promise<string> {
  const { user } = await withAuth();
  if (!user) throw new UnauthorizedError();
  return user.id;
}

/** Same as getSessionUserId, but returns null instead of throwing when signed out. */
export async function getOptionalSessionUserId(): Promise<string | null> {
  const { user } = await withAuth();
  return user?.id ?? null;
}
