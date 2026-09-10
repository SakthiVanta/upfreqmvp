// Client-side API wrapper for registered bridge endpoints
// (upfreq.bridge.register_endpoint). Server state lives in
// src/lib/db/bridge-endpoints.ts — this just shapes the fetch.

export interface BridgeEndpoint {
  id: string;
  projectId: string;
  machineId: string;
  endpointType: string;
  url: string;
  lastSeenAt: string;
  createdAt: string;
}

export async function fetchBridgeEndpoints(projectId?: string): Promise<BridgeEndpoint[]> {
  const res = await fetch(`/api/bridges${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export interface RegisterBridgeEndpointInput {
  projectId: string;
  machineId: string;
  endpointType: 'isaac_sim' | 'foxglove' | 'zenoh';
  url: string;
  apiKey?: string;
}

export async function registerBridgeEndpoint(input: RegisterBridgeEndpointInput): Promise<BridgeEndpoint> {
  const res = await fetch('/api/bridges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// https://docs.foxglove.dev/docs/visualization/shareable-links — deep-links
// the Foxglove web app to auto-connect to a live WebSocket bridge.
export function foxgloveDeepLink(wsUrl: string): string {
  return `https://app.foxglove.dev/~/view?ds=foxglove-websocket&ds.url=${encodeURIComponent(wsUrl)}`;
}
