// Client-side API wrapper for per-machine workspace registrations
// (upfreq.workspace.register). Server state lives in
// src/lib/db/workspace-registrations.ts — this just shapes the fetch.

export interface WorkspaceRegistration {
  id: string;
  projectId: string;
  machineId: string;
  localPath: string;
  lastSeenAt: string;
  createdAt: string;
}

export async function fetchWorkspaces(projectId?: string): Promise<WorkspaceRegistration[]> {
  const res = await fetch(`/api/workspaces${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
