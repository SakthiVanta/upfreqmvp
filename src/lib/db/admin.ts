import { eq } from 'drizzle-orm';
import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { deleteStlFromBlob } from '../cad/blob-storage';

/**
 * Wipes only the calling user's own workspace data — every table with a
 * `userId` FK to `users.id` that the app actually writes to (`assets`,
 * `experiments`, `simulationProfiles`, `agentChatMessages` are defined in
 * schema.ts but nothing currently writes to them — nothing to reset there
 * yet). Deliberately does NOT touch the `users` row itself or any other
 * user's data — this is what backs the app's "Reset DB" button now that
 * real, multi-tenant WorkOS accounts exist.
 * (`resetDatabaseAndSeedDemoUser` below is the old single-tenant version,
 * kept only for local seed scripts that run outside any request/session
 * context.)
 */
export async function resetUserWorkspaceData(userId: string) {
  const db = getDb();
  if (!db) {
    return { success: true, message: 'Local workspace reset (no database configured).' };
  }

  try {
    // Delete the user's compiled STL blobs from Vercel Blob storage before
    // dropping their cadParts rows — otherwise those binaries orphan
    // permanently (Postgres deletion doesn't touch external blob storage),
    // silently accumulating storage cost for parts nobody can reach anymore.
    const cadRows = await db
      .select({ stlUrl: schema.cadParts.stlUrl })
      .from(schema.cadParts)
      .where(eq(schema.cadParts.userId, userId));
    await Promise.all(cadRows.filter(r => r.stlUrl).map(r => deleteStlFromBlob(r.stlUrl!)));

    // mcpRobots.projectId is onDelete:'set null' (not cascade) and
    // workspaceRegistrations/bridgeEndpoints/cadParts/customTestCases/
    // policyProposals aren't reachable by deleting projects alone either —
    // each needs its own explicit userId-scoped delete, not just the
    // projects/robots/testRuns cascade chain. payments is deliberately
    // excluded — it's a financial audit trail, never wiped by a workspace
    // reset (see its comment in schema.ts).
    await Promise.all([
      db.delete(schema.projects).where(eq(schema.projects.userId, userId)),
      db.delete(schema.robots).where(eq(schema.robots.userId, userId)),
      db.delete(schema.testRuns).where(eq(schema.testRuns.userId, userId)),
      db.delete(schema.mcpRobots).where(eq(schema.mcpRobots.userId, userId)),
      db.delete(schema.workspaceRegistrations).where(eq(schema.workspaceRegistrations.userId, userId)),
      db.delete(schema.bridgeEndpoints).where(eq(schema.bridgeEndpoints.userId, userId)),
      db.delete(schema.cadParts).where(eq(schema.cadParts.userId, userId)),
      db.delete(schema.customTestCases).where(eq(schema.customTestCases.userId, userId)),
      db.delete(schema.policyProposals).where(eq(schema.policyProposals.userId, userId)),
    ]);

    return { success: true, message: 'Your workspace data has been reset.' };
  } catch (err: any) {
    console.error(`[WORKSPACE RESET ERROR] ${err.message}`);
    return { success: false, message: `Workspace reset error: ${err.message}` };
  }
}

/** @deprecated Single-tenant demo-data reset for local dev/seed scripts only — do not call from any app route. */
export async function resetDatabaseAndSeedDemoUser() {
  try {
    const db = getDb();
    if (!db) {
      console.log('[NEON DB] DATABASE_URL not configured. Resetting local state.');
      return { success: true, message: 'Local workspace reset to clean demo user state.' };
    }

    // Every child table's FK to users is onDelete: 'cascade' (robots,
    // projects — which itself cascades to project_repositories), and
    // there's only ever this one demo user, so deleting it is a single
    // round-trip that wipes everything scoped to it.
    await db.delete(schema.users);

    await db.insert(schema.users).values({
      id: DEMO_USER_ID,
      email: 'engineering@ekumenlabs.com',
      name: 'Ekumen OS Robotics Team',
      githubId: 'ekumen-engineer',
      avatarUrl: 'https://github.com/Ekumen-OS.png'
    });

    const { seedRoboticsFleetAndEnvironments } = await import('./seed-data');
    await seedRoboticsFleetAndEnvironments(DEMO_USER_ID);

    console.log('[NEON DB] Database reset complete! Clean demo user & robotics fleet seeded.');
    return { success: true, message: 'Neon PostgreSQL database reset cleanly with demo user, TurtleBot 4/3, and Andino fleet.' };
  } catch (err: any) {
    console.error(`[NEON DB RESET ERROR] ${err.message}`);
    return { success: false, message: `Database reset error: ${err.message}` };
  }
}
