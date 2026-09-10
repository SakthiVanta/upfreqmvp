import type { User as WorkosUser } from '@workos-inc/node';
import { getDb } from '@/lib/db/client';
import * as schema from '@/lib/schema';

/**
 * Idempotent upsert of a WorkOS-authenticated user into our `users` table,
 * keyed directly on the WorkOS user id (see src/lib/schema.ts — every other
 * table's userId FK already points at users.id, so no mapping column is
 * needed). Called from two convergent entry points: the browser login
 * callback (src/app/api/auth/callback/route.ts) and, on first sight of a
 * bearer token, the MCP resource server (src/lib/auth/mcp-auth.ts).
 */
export async function upsertUserFromWorkos(user: Pick<WorkosUser, 'id' | 'email' | 'firstName' | 'lastName' | 'profilePictureUrl'>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;

  await db
    .insert(schema.users)
    .values({
      id: user.id,
      email: user.email,
      name,
      avatarUrl: user.profilePictureUrl ?? null,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { email: user.email, name, avatarUrl: user.profilePictureUrl ?? null },
    });
}
