import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { RobotProfile } from '../robot-profile';
import { saveRobotProfile } from './robots';

export interface ProjectRepoRecord {
  id: string;
  url: string;
  name: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repos: ProjectRepoRecord[];
  isAudited: boolean;
  auditedRobotProfile?: RobotProfile;
}

export interface ProjectRepoInput {
  url: string;
  name?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  addRepo?: ProjectRepoInput;
  removeRepoId?: string;
  /** Full profile overwrite — used when the Codebase Review UI edits custom
   * metrics/sim assets on an already-audited project. Persisted via the same
   * upsert an audit run uses, keyed to this project. */
  auditedRobotProfile?: RobotProfile;
}

function fallbackRepoName(url: string) {
  return url.split('/').pop() || 'robotics_repo';
}

type Db = NonNullable<ReturnType<typeof getDb>>;

// Robots aren't uniquely one-per-project at the schema level (a project's
// repos could each be audited independently), but the app only ever audits
// a project's primary repo — so in practice there's at most one. Sorting
// ascending by analyzedAt and letting later rows overwrite earlier ones in
// the map keeps this correct even if that ever changes.
async function latestAuditedProfileByProject(db: Db, projectIds: string[]): Promise<Map<string, RobotProfile>> {
  const map = new Map<string, RobotProfile>();
  if (projectIds.length === 0) return map;

  const rows = await db
    .select()
    .from(schema.robots)
    .where(inArray(schema.robots.projectId, projectIds))
    .orderBy(schema.robots.analyzedAt);

  for (const row of rows) {
    if (row.projectId) map.set(row.projectId, row.profileJson as RobotProfile);
  }
  return map;
}

function toRecord(
  p: typeof schema.projects.$inferSelect,
  repoRows: (typeof schema.projectRepositories.$inferSelect)[],
  profile: RobotProfile | undefined
): ProjectRecord {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    repos: repoRows.filter(r => r.projectId === p.id).map(r => ({ id: r.id, url: r.repoUrl, name: r.repoName })),
    isAudited: !!profile,
    auditedRobotProfile: profile,
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = getDb();
  if (!db) return [];

  const projectRows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, DEMO_USER_ID))
    .orderBy(desc(schema.projects.createdAt));

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map(p => p.id);
  const [repoRows, profileMap] = await Promise.all([
    db.select().from(schema.projectRepositories).where(inArray(schema.projectRepositories.projectId, projectIds)),
    latestAuditedProfileByProject(db, projectIds),
  ]);

  return projectRows.map(p => toRecord(p, repoRows, profileMap.get(p.id)));
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const db = getDb();
  if (!db) return null;

  const [p] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, DEMO_USER_ID)));
  if (!p) return null;

  const [repoRows, profileMap] = await Promise.all([
    db.select().from(schema.projectRepositories).where(eq(schema.projectRepositories.projectId, projectId)),
    latestAuditedProfileByProject(db, [projectId]),
  ]);

  return toRecord(p, repoRows, profileMap.get(projectId));
}

export async function createProject(input: { name: string; description?: string; repos?: ProjectRepoInput[] }): Promise<ProjectRecord> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  const id = `proj_${Date.now()}`;
  const name = input.name.trim();
  const description = input.description?.trim() || '';

  await db.insert(schema.projects).values({ id, userId: DEMO_USER_ID, name, description });

  const repos: ProjectRepoRecord[] = (input.repos || []).map((r, idx) => ({
    id: `repo_${Date.now()}_${idx}`,
    url: r.url,
    name: r.name || fallbackRepoName(r.url),
  }));

  if (repos.length > 0) {
    await db.insert(schema.projectRepositories).values(
      repos.map((r, idx) => ({
        id: r.id,
        projectId: id,
        repoUrl: r.url,
        repoName: r.name,
        isPrimary: idx === 0,
      }))
    );
  }

  return { id, name, description, repos, isAudited: false };
}

export async function updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectRecord | null> {
  const db = getDb();
  if (!db) return null;

  // Unlike createProject (where the repo insert's FK genuinely can't
  // resolve until the project row it points at has committed), every
  // operation here targets a project that already exists — none of these
  // four depend on each other, so run whichever ones this call actually
  // asked for concurrently instead of one round-trip at a time.
  const writes: Promise<unknown>[] = [];

  if (input.name !== undefined || input.description !== undefined) {
    writes.push(
      db
        .update(schema.projects)
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, DEMO_USER_ID)))
    );
  }

  if (input.addRepo) {
    writes.push(
      db.insert(schema.projectRepositories).values({
        id: `repo_${Date.now()}`,
        projectId,
        repoUrl: input.addRepo.url,
        repoName: input.addRepo.name || fallbackRepoName(input.addRepo.url),
      })
    );
  }

  if (input.removeRepoId) {
    writes.push(
      db
        .delete(schema.projectRepositories)
        .where(and(eq(schema.projectRepositories.id, input.removeRepoId), eq(schema.projectRepositories.projectId, projectId)))
    );
  }

  if (input.auditedRobotProfile) {
    writes.push(saveRobotProfile(input.auditedRobotProfile, projectId));
  }

  if (writes.length > 0) await Promise.all(writes);

  return getProject(projectId);
}

// Repos and the project row itself cascade-delete at the schema level
// (project_repositories.project_id → cascade); a project's past robot
// audits are kept, just unlinked (robots.project_id → set null), so audit
// history survives deleting the project it was run under.
export async function deleteProject(projectId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, DEMO_USER_ID)));
}
