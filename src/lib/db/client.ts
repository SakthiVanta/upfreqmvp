import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from '../schema';

const connectionString = process.env.DATABASE_URL;

// Auth is currently mocked (no real GitHub OAuth wired up yet — see
// auth-context.tsx) so every session resolves to this one standing
// identity. Swap for the real authenticated user's id once OAuth lands.
export const DEMO_USER_ID = 'usr_demo_ekumen';

export function getDb() {
  if (connectionString && connectionString.startsWith('postgres')) {
    const sql = neon(connectionString);
    return drizzleNeon(sql, { schema });
  }
  return null;
}
