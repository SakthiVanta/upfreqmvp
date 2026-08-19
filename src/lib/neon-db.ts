import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema';
import { RobotProfile } from './robot-profile';

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

export async function resetDatabaseAndSeedDemoUser() {
  try {
    const db = getDb();
    if (!db) {
      console.log('[NEON DB] DATABASE_URL not configured. Resetting local state.');
      return { success: true, message: 'Local workspace reset to clean demo user state.' };
    }

    await db.delete(schema.robots);
    await db.delete(schema.projectRepositories);
    await db.delete(schema.projects);
    await db.delete(schema.users);

    await db.insert(schema.users).values({
      id: DEMO_USER_ID,
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

/**
 * Persists a completed analysis as the durable Robot Library entry. Stores
 * the full RobotProfile (sensors, evidence-based autonomy classification,
 * data-flow pipeline, Nav2 stack, etc.) — not a hand-picked subset — so the
 * database is an actual source of truth, not write-only telemetry.
 * Re-auditing the same repo for the same user updates the existing row.
 */
export async function saveRobotProfile(profile: RobotProfile, projectId?: string | null): Promise<{ success: boolean; id?: string }> {
  try {
    const db = getDb();
    if (!db) {
      console.log('[NEON DB] DATABASE_URL not configured. Skipping remote Neon save.');
      return { success: false };
    }

    const id = `robot_${profile.id}_${Date.now()}`;
    const repoName = profile.repoUrl.split('/').pop() || profile.id;

    const [row] = await db
      .insert(schema.robots)
      .values({
        id,
        userId: DEMO_USER_ID,
        projectId: projectId || null,
        repoUrl: profile.repoUrl,
        repoName,
        robotName: profile.name,
        rosVersion: profile.rosVersion,
        sensorCount: profile.sensors.length,
        moduleCount: profile.autonomyModules?.length || 0,
        profileJson: profile,
      })
      .onConflictDoUpdate({
        target: [schema.robots.userId, schema.robots.repoUrl],
        set: {
          projectId: projectId || null,
          repoName,
          robotName: profile.name,
          rosVersion: profile.rosVersion,
          sensorCount: profile.sensors.length,
          moduleCount: profile.autonomyModules?.length || 0,
          profileJson: profile,
          analyzedAt: new Date(),
        },
      })
      .returning({ id: schema.robots.id });

    console.log(`[NEON DB] Saved robot profile to Neon PostgreSQL: ${profile.repoUrl}`);
    return { success: true, id: row?.id };
  } catch (err: any) {
    console.error(`[NEON DB ERROR] Failed to save robot profile: ${err.message}`);
    return { success: false };
  }
}

export interface RobotLibraryRow {
  id: string;
  repoUrl: string;
  repoName: string;
  robotName: string;
  rosVersion: string | null;
  sensorCount: number;
  moduleCount: number;
  analyzedAt: Date;
  profile: RobotProfile;
}

export async function listRobotsForUser(userId: string = DEMO_USER_ID): Promise<RobotLibraryRow[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(schema.robots)
    .where(eq(schema.robots.userId, userId))
    .orderBy(schema.robots.analyzedAt);

  return rows
    .map(r => ({
      id: r.id,
      repoUrl: r.repoUrl,
      repoName: r.repoName,
      robotName: r.robotName,
      rosVersion: r.rosVersion,
      sensorCount: r.sensorCount,
      moduleCount: r.moduleCount,
      analyzedAt: r.analyzedAt,
      profile: r.profileJson as RobotProfile,
    }))
    .reverse();
}

export async function deleteRobot(id: string, userId: string = DEMO_USER_ID): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await db.delete(schema.robots).where(and(eq(schema.robots.id, id), eq(schema.robots.userId, userId)));
  return true;
}
