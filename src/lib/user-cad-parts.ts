// Client-side API wrapper for saved CAD parts (upfreq.cad.save_part).
// Server state lives in src/lib/db/cad-parts.ts — this just shapes the fetch.

export interface CadPart {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  scadSource: string;
  stlUrl: string | null;
  massProperties: {
    volumeM3: number;
    massKg: number;
    boundingBox: { size: { x: number; y: number; z: number } };
  } | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCadParts(projectId?: string): Promise<CadPart[]> {
  const res = await fetch(`/api/cad-parts${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
