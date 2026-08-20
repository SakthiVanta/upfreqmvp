import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { RobotProfile } from '../robot-profile';

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
