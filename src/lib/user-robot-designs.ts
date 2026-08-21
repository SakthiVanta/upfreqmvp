// Client-side API wrapper for the Robots feature. Designs are server state
// (Neon Postgres, via src/lib/db/robot-designs.ts) — this module just shapes
// the fetch calls, it holds no state of its own.
import { upload } from '@vercel/blob/client';
import { RobotLink, RobotJoint } from './urdf/types';
import type { TopologyComponent, TopologySuggestion, TopologyBlueprint } from './agent/topology';

export type { TopologyComponent, TopologySuggestion, TopologyJointSuggestion, TopologyBlueprint, BlueprintJointSuggestion } from './agent/topology';

export type AiGenerateResult =
  | { mode: 'topology'; suggestion: TopologySuggestion }
  | { mode: 'blueprint'; blueprint: TopologyBlueprint };

export type { RobotLink, RobotJoint, JointType, Vec3, Origin } from './urdf/types';

export interface MeshFile {
  id: string;
  designId: string;
  url: string;
  originalFilename: string;
  extension: string;
  sizeBytes: number;
}

export interface RobotDesign {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  links: RobotLink[];
  joints: RobotJoint[];
  urdfXml: string | null;
  status: 'draft' | 'exported';
  meshFiles: MeshFile[];
}

async function parseOrThrow(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function fetchRobotDesigns(): Promise<RobotDesign[]> {
  const res = await fetch('/api/robot-designs');
  return parseOrThrow(res);
}

export async function fetchRobotDesign(id: string): Promise<RobotDesign | null> {
  const res = await fetch(`/api/robot-designs/${id}`);
  if (res.status === 404) return null;
  return parseOrThrow(res);
}

export async function createRobotDesign(input: { name: string; description?: string; projectId?: string }): Promise<RobotDesign> {
  const res = await fetch('/api/robot-designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res);
}

export interface RobotDesignUpdateInput {
  name?: string;
  description?: string;
  links?: RobotLink[];
  joints?: RobotJoint[];
  urdfXml?: string;
  status?: 'draft' | 'exported';
}

export async function updateRobotDesign(id: string, input: RobotDesignUpdateInput): Promise<RobotDesign | null> {
  const res = await fetch(`/api/robot-designs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.status === 404) return null;
  return parseOrThrow(res);
}

export async function deleteRobotDesign(id: string): Promise<void> {
  const res = await fetch(`/api/robot-designs/${id}`, { method: 'DELETE' });
  await parseOrThrow(res);
}

const ALLOWED_MESH_EXTENSIONS = ['stl', 'obj', 'glb', 'gltf'];

// Uploads go straight from the browser to Blob storage (a short-lived
// client token is fetched from /files/client-upload first), then the
// resulting blob is registered as a mesh file row via /files/register. This
// avoids proxying the file bytes through a Next.js serverless function,
// which has a payload limit well under what a real mesh file can hit.
export async function uploadMeshFile(designId: string, file: File): Promise<MeshFile> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_MESH_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported file type ".${extension}" — use .stl, .obj, .glb, or .gltf`);
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `robot-designs/${designId}/${Date.now()}-${sanitizedName}`;

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: `/api/robot-designs/${designId}/files/client-upload`,
  });

  const res = await fetch(`/api/robot-designs/${designId}/files/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: blob.url,
      pathname: blob.pathname,
      originalFilename: file.name,
      extension,
      sizeBytes: file.size,
    }),
  });
  return parseOrThrow(res);
}

export async function deleteMeshFile(designId: string, fileId: string): Promise<void> {
  const res = await fetch(`/api/robot-designs/${designId}/files/${fileId}`, { method: 'DELETE' });
  await parseOrThrow(res);
}

// Pure suggestion — makes no changes to the design. The caller (AiGeneratePanel)
// shows this as a review before anything is persisted. Empty `components`
// switches the server to blueprint mode (text-only skeleton), which requires
// `userContext` to be non-empty.
export async function generateTopologySuggestion(components: TopologyComponent[], userContext?: string): Promise<AiGenerateResult> {
  const res = await fetch('/api/robot-designs/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ components, userContext }),
  });
  return parseOrThrow(res);
}
