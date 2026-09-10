import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { assertPublicHttpUrl } from './bridge-http';

const MACHINE_ID_HINT =
  'Requires a stable machineId identifying this computer — before calling, check for a UUID at ~/.upfreq/machine-id on the local machine; ' +
  'if it does not exist, generate one (e.g. `uuidgen` or `node -e "console.log(crypto.randomUUID())"`), write it there, and reuse it for every workspace/bridge call from this machine. ' +
  'This is a best-effort, client-reported identifier — not a verified hardware fingerprint.';

const ENDPOINT_TYPE_SCHEMA = z.enum(['isaac_sim', 'foxglove', 'zenoh']);

export const registerBridgeEndpointAction: AgentNativeAction = {
  id: 'upfreq.bridge.register_endpoint',
  namespace: 'upfreq.bridge',
  name: 'register_endpoint',
  description:
    'Registers (or updates) the URL of a service running on the user\'s own GPU box for this project/machine — the Isaac Sim bridge server (isaac_sim), a Foxglove bridge WebSocket endpoint (foxglove) for live 3D visualization, or a Zenoh router endpoint (zenoh) for live ROS 2 topic streaming. ' +
    'UpFreq never hosts or proxies these services itself — this just remembers the URL so it does not need to be re-typed on every call, and so the webapp can surface it (e.g. "open this in Foxglove Studio"). ' +
    `${MACHINE_ID_HINT}`,
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string(),
    machineId: z.string().describe('This machine\'s persisted UUID from ~/.upfreq/machine-id'),
    endpointType: ENDPOINT_TYPE_SCHEMA,
    url: z.string().url().describe('Publicly reachable base URL of the service, e.g. a Tailscale/tunnel address — not localhost, since UpFreq calls this from its own backend, not the user\'s machine'),
    apiKey: z.string().optional().describe('Optional X-UpFreq-Key header this endpoint requires'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    // Validated up front (not just left to whatever action later dereferences
    // it) so a bad or private URL is rejected at registration time with a
    // clear error, rather than surfacing as a confusing failure deep inside
    // an unrelated sim/ROS call that resolves it later.
    await assertPublicHttpUrl(input.url);

    const { registerBridgeEndpoint } = await import('@/lib/db/bridge-endpoints');
    const endpoint = await registerBridgeEndpoint(context.userId, input.projectId, input.machineId, input.endpointType, input.url, input.apiKey);
    return { success: true, endpoint, message: `Registered ${input.endpointType} endpoint ${input.url} for this project on this machine.` };
  },
};

export const getBridgeEndpointAction: AgentNativeAction = {
  id: 'upfreq.bridge.get_endpoint',
  namespace: 'upfreq.bridge',
  name: 'get_endpoint',
  description: `Looks up a previously-registered bridge endpoint URL (isaac_sim / foxglove / zenoh) for this project on this machine, if any. ${MACHINE_ID_HINT}`,
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string(),
    machineId: z.string().describe('This machine\'s persisted UUID from ~/.upfreq/machine-id'),
    endpointType: ENDPOINT_TYPE_SCHEMA,
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { found: false };
    }

    const { getBridgeEndpoint } = await import('@/lib/db/bridge-endpoints');
    const endpoint = await getBridgeEndpoint(context.userId, input.projectId, input.machineId, input.endpointType);
    if (!endpoint) {
      return { found: false, message: `No ${input.endpointType} endpoint registered for this project on this machine yet — register one with upfreq.bridge.register_endpoint.` };
    }
    return { found: true, url: endpoint.url, lastSeenAt: endpoint.lastSeenAt };
  },
};

export const listBridgeEndpointsAction: AgentNativeAction = {
  id: 'upfreq.bridge.list_endpoints',
  namespace: 'upfreq.bridge',
  name: 'list_endpoints',
  description: 'Lists every registered bridge endpoint (Isaac Sim / Foxglove / Zenoh) for the current user, optionally scoped to one project.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional(),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { count: 0, endpoints: [] };
    }

    const { listBridgeEndpoints } = await import('@/lib/db/bridge-endpoints');
    const endpoints = await listBridgeEndpoints(context.userId, input.projectId);
    return { count: endpoints.length, endpoints };
  },
};

export const bridgeActions = [
  registerBridgeEndpointAction,
  getBridgeEndpointAction,
  listBridgeEndpointsAction,
];
