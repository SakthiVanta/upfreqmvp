import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ActionExecutionContext } from '../types';

export function buildHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-UpFreq-Key'] = apiKey;
  return headers;
}

// Every action in this file (and testing.ts/simulation.ts/ros.ts) fetches a
// user-supplied serverUrl from UpFreq's own backend, not the browser —
// without this guard, a caller could point it at cloud metadata endpoints,
// internal admin services, or anything else reachable from our network, and
// get the response echoed back through the tool result. Only http(s) to a
// resolved public IP is allowed; every address a hostname resolves to is
// checked, not just the first, since a caller could otherwise return a mix
// of public/private records.
export function isPrivateOrReservedIp(ip: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
  if (lower.startsWith('::ffff:')) return isPrivateOrReservedIp(lower.replace('::ffff:', ''), 4);
  return false;
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${url.protocol}" — serverUrl must be http:// or https://.`);
  }

  const hostname = url.hostname;
  if (hostname === 'localhost') {
    throw new Error('serverUrl cannot be localhost — this action runs on UpFreq\'s backend, not your machine.');
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await dnsLookup(hostname, { all: true }).catch(() => {
        throw new Error(`Could not resolve host "${hostname}".`);
      });

  for (const { address, family } of addresses) {
    if (isPrivateOrReservedIp(address, family)) {
      throw new Error(`serverUrl resolves to a private/internal address (${address}) — not reachable, and not allowed for security reasons.`);
    }
  }

  return url;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Connection to the bridge server timed out.');
    throw new Error(err.message || 'Could not connect to the bridge server.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkServerHealth(serverUrl: string, apiKey?: string): Promise<void> {
  const res = await fetchWithTimeout(`${serverUrl}/health`, { method: 'GET', headers: buildHeaders(apiKey) });
  if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
}

// GET/POST helpers for the "thing upfreq agent" REST contract — the small
// HTTP surface a user's own GPU-side companion process is expected to
// implement (alongside /health and /api/v1/run-test from testing.ts) so
// UpFreq's cloud MCP server can drive it without us hosting or proxying any
// simulation/streaming infrastructure ourselves.
export async function bridgePost<T = any>(serverUrl: string, path: string, body: unknown, apiKey?: string): Promise<T> {
  const res = await fetchWithTimeout(`${serverUrl}${path}`, { method: 'POST', headers: buildHeaders(apiKey), body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || data?.error || `Bridge server request failed (HTTP ${res.status})`);
  return (data || {}) as T;
}

export async function bridgeGet<T = any>(serverUrl: string, path: string, apiKey?: string): Promise<T> {
  const res = await fetchWithTimeout(`${serverUrl}${path}`, { method: 'GET', headers: buildHeaders(apiKey) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || data?.error || `Bridge server request failed (HTTP ${res.status})`);
  return (data || {}) as T;
}

// Resolves the server to call: an explicit serverUrl always wins; otherwise,
// given a projectId + machineId, look up a previously-registered bridge
// endpoint of the given type (see actions/bridge.ts) so the caller doesn't
// have to keep re-typing the same URL on every single sim/ROS call once
// it's been registered once.
export async function resolveBridgeServerUrl(
  context: ActionExecutionContext,
  endpointType: 'isaac_sim' | 'foxglove' | 'zenoh',
  explicitUrl: string | undefined,
  projectId: string | undefined,
  machineId: string | undefined
): Promise<{ serverUrl: string; apiKey?: string }> {
  if (explicitUrl) {
    const url = await assertPublicHttpUrl(explicitUrl);
    return { serverUrl: url.toString().replace(/\/+$/, '') };
  }

  if (!context.userId || !projectId || !machineId) {
    throw new Error('No serverUrl given, and no projectId/machineId to look up a registered bridge endpoint — pass serverUrl directly, or projectId + machineId for a previously-registered one.');
  }

  const { getBridgeEndpoint } = await import('@/lib/db/bridge-endpoints');
  const endpoint = await getBridgeEndpoint(context.userId, projectId, machineId, endpointType);
  if (!endpoint) {
    throw new Error(`No ${endpointType} bridge endpoint registered for this project on this machine — pass serverUrl directly, or call upfreq.bridge.register_endpoint first.`);
  }

  const url = await assertPublicHttpUrl(endpoint.url);
  return { serverUrl: url.toString().replace(/\/+$/, ''), apiKey: endpoint.apiKey || undefined };
}
