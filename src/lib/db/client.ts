import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from '../schema';

const connectionString = process.env.DATABASE_URL;

// Real WorkOS AuthKit auth now exists (src/proxy.ts, src/lib/auth/session.ts)
// — every request-scoped DB call should thread a real userId through instead
// of this constant. Still used by local seed scripts (scripts/seed-fleet.ts,
// scripts/seed-provider-models.ts) which run outside any session context.
export const DEMO_USER_ID = 'usr_demo_ekumen';

export function getDb() {
  if (connectionString && connectionString.startsWith('postgres')) {
    const sql = neon(connectionString);
    return drizzleNeon(sql, { schema });
  }
  return null;
}
