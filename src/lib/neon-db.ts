import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

export function getDb() {
  if (connectionString && connectionString.startsWith('postgres')) {
    const sql = neon(connectionString);
    return drizzleNeon(sql, { schema });
  }
  return null;
}

export async function resetDatabaseAndSeedDemoUser() {
  try {
    const db = getDb();
    if (!db) {
      console.log('[NEON DB] DATABASE_URL not configured. Resetting local state.');
      return { success: true, message: 'Local workspace reset to clean demo user state.' };
    }

    // Delete existing tables data
    await db.delete(schema.parametricProfiles);
    await db.delete(schema.analyzedRepositories);
    await db.delete(schema.projectRepositories);
    await db.delete(schema.projects);
    await db.delete(schema.users);

    // Insert clean Demo User
    const demoUserId = 'usr_demo_ekumen';
    await db.insert(schema.users).values({
      id: demoUserId,
      email: 'engineering@ekumenlabs.com',
      name: 'Ekumen OS Robotics Team',
      githubId: 'ekumen-engineer',
      avatarUrl: 'https://github.com/Ekumen-OS.png'
    });

    console.log('[NEON DB] Database reset complete! Clean demo user inserted.');
    return { success: true, message: 'Neon PostgreSQL database reset cleanly with demo user.' };
  } catch (err: any) {
    console.error(`[NEON DB RESET ERROR] ${err.message}`);
    return { success: false, message: `Database reset error: ${err.message}` };
  }
}

export async function saveRepositoryToNeon(repoUrl: string, analysisResult: any, projectId?: string) {
  try {
    const db = getDb();
    if (!db) {
      console.log('[NEON DB] DATABASE_URL not configured yet. Skipping remote Neon save.');
      return false;
    }

    const id = `repo_${Date.now()}`;
    await db.insert(schema.analyzedRepositories).values({
      id,
      projectId: projectId || null,
      repoUrl,
      repoName: repoUrl.split('/').pop() || 'robotics_repo',
      rosDistribution: 'humble',
      urdfAstJson: JSON.stringify(analysisResult.urdf || {}),
      nav2ConfigJson: JSON.stringify(analysisResult.nav2 || {}),
      gazeboPluginsJson: JSON.stringify(analysisResult.gazebo || []),
      isaacTestsJson: JSON.stringify(analysisResult.isaacTests || [])
    });

    console.log(`[NEON DB] Saved repository analysis to Neon PostgreSQL database: ${repoUrl}`);
    return true;
  } catch (err: any) {
    console.error(`[NEON DB ERROR] Failed to save to Neon DB: ${err.message}`);
    return false;
  }
}
