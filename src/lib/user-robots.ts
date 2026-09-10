// Client-side API wrapper for robots saved via MCP (upfreq.robot.save_robot).
// Server state lives in src/lib/db/mcp-robots.ts — this just shapes the fetch.

export interface McpRobotChassis {
  length?: number;
  width?: number;
  height?: number;
  massKg?: number;
  inertia?: { ixx: number; iyy: number; izz: number };
}

export interface McpRobot {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  description: string;
  driveType: string | null;
  chassis: McpRobotChassis;
  sensors: string[];
  urdfXacroXml: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRobots(projectId?: string): Promise<McpRobot[]> {
  const res = await fetch(`/api/robots${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
