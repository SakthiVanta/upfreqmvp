import { IsaacSimServerConfig, IsaacSimHealthResponse, LoadToIsaacSimPayload, LoadToIsaacSimResult } from './types';

const STORAGE_KEY = 'upfreq_isaac_sim_config';

export const DEFAULT_ISAAC_CONFIG: IsaacSimServerConfig = {
  serverUrl: 'http://localhost:8000',
  webrtcStreamUrl: 'ws://localhost:49100',
  autoConnect: false,
  groundPlane: 'grid',
};

export function getSavedIsaacConfig(): IsaacSimServerConfig {
  if (typeof window === 'undefined') return DEFAULT_ISAAC_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ISAAC_CONFIG;
    return { ...DEFAULT_ISAAC_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ISAAC_CONFIG;
  }
}

export function saveIsaacConfig(config: IsaacSimServerConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Isaac Sim config:', e);
  }
}

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['X-UpFreq-Key'] = apiKey;
  }
  return headers;
}

export async function checkServerHealth(serverUrl: string, apiKey?: string): Promise<IsaacSimHealthResponse> {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${cleanUrl}/health`, {
      method: 'GET',
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Ensure Isaac Sim Bridge server is running and the port is reachable.');
    }
    throw new Error(err.message || 'Could not connect to Isaac Sim Bridge server.');
  }
}

export async function loadRobotToIsaacSim(
  serverUrl: string,
  payload: LoadToIsaacSimPayload,
  apiKey?: string
): Promise<LoadToIsaacSimResult> {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const res = await fetch(`${cleanUrl}/api/v1/load-robot`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `Failed to load robot into Isaac Sim (${res.status})`);
  }
  return data;
}

export async function sendSimCommand(
  serverUrl: string,
  action: 'play' | 'pause' | 'reset',
  apiKey?: string
): Promise<{ status: string }> {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const res = await fetch(`${cleanUrl}/api/v1/simulation/${action}`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `Simulation command "${action}" failed (${res.status})`);
  }
  return data;
}
