// Client-side API wrapper for the Projects feature. Projects are server
// state (Neon Postgres, via src/lib/db/projects.ts) — this module just
// shapes the fetch calls, it holds no state of its own.
import { RobotProfile } from './robot-profile';

export interface ProjectRepo {
  id: string;
  url: string;
  name: string;
}

export interface UserProject {
  id: string;
  name: string;
  description: string;
  repos: ProjectRepo[];
  isAudited: boolean;
  auditedRobotProfile?: RobotProfile;
}

async function parseOrThrow(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function fetchProjects(): Promise<UserProject[]> {
  const res = await fetch('/api/projects');
  return parseOrThrow(res);
}

export async function fetchProject(id: string): Promise<UserProject | null> {
  const res = await fetch(`/api/projects/${id}`);
  if (res.status === 404) return null;
  return parseOrThrow(res);
}

export async function createProject(input: { name: string; description?: string; repos?: { url: string; name?: string }[] }): Promise<UserProject> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res);
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  addRepo?: { url: string; name?: string };
  removeRepoId?: string;
  auditedRobotProfile?: RobotProfile;
}

export async function updateProject(id: string, input: ProjectUpdateInput): Promise<UserProject | null> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.status === 404) return null;
  return parseOrThrow(res);
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  await parseOrThrow(res);
}
