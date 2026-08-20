import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { seedProviderModels } from './provider-models';

export async function resetDatabaseAndSeedDemoUser() {
  try {
    const db = getDb();
    if (!db) {
      console.log('[NEON DB] DATABASE_URL not configured. Resetting local state.');
      return { success: true, message: 'Local workspace reset to clean demo user state.' };
    }

    // Every child table's FK to users is onDelete: 'cascade' (robots,
    // agent_settings, user_api_keys, projects — which itself cascades to
    // project_repositories), and there's only ever this one demo user, so
    // deleting it is a single round-trip that wipes everything scoped to
    // it. (provider_models isn't user-scoped and is deliberately untouched
    // here — reseeded below instead.)
    await db.delete(schema.users);

    await db.insert(schema.users).values({
      id: DEMO_USER_ID,
      email: 'engineering@ekumenlabs.com',
      name: 'Ekumen OS Robotics Team',
      githubId: 'ekumen-engineer',
      avatarUrl: 'https://github.com/Ekumen-OS.png'
    });

    // provider_models isn't user-scoped and isn't wiped above, but a
    // brand-new database has never had it seeded — this upsert is a no-op
    // once it's already populated, so it's safe to run on every reset.
    await seedProviderModels();

    console.log('[NEON DB] Database reset complete! Clean demo user inserted.');
    return { success: true, message: 'Neon PostgreSQL database reset cleanly with demo user.' };
  } catch (err: any) {
    console.error(`[NEON DB RESET ERROR] ${err.message}`);
    return { success: false, message: `Database reset error: ${err.message}` };
  }
}
