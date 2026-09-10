import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { executeCleanResetProtocol } from '@/lib/simulation/clean-reset';
import { resolveBridgeServerUrl, bridgePost, bridgeGet, checkServerHealth } from './bridge-http';

// serverUrl is optional on every action here — if omitted, we fall back to
// a bridge endpoint previously registered via upfreq.bridge.register_endpoint
// for this (projectId, machineId). Either way, this is a real HTTP call to
// the user's own "thing upfreq agent" on their GPU box (see bridge-http.ts)
// — UpFreq never runs Isaac Sim itself.
const SERVER_TARGET_FIELDS = {
  serverUrl: z.string().url().optional().describe('Base URL of the Isaac Sim bridge server, e.g. https://my-tunnel.example.com. Omit if you\'ve already registered one via upfreq.bridge.register_endpoint for this projectId/machineId.'),
  apiKey: z.string().optional().describe('Optional X-UpFreq-Key header for the bridge server'),
  projectId: z.string().optional().describe('Used with machineId to look up a registered isaac_sim bridge endpoint if serverUrl is omitted'),
  machineId: z.string().optional().describe('Used with projectId to look up a registered isaac_sim bridge endpoint if serverUrl is omitted'),
};

export const setupIsaacSimAction: AgentNativeAction = {
  id: 'upfreq.simulation.setup_isaac_sim',
  namespace: 'upfreq.simulation',
  name: 'setup_isaac_sim',
  description:
    'The simple "set up my Isaac Sim" entry point: given your Isaac Sim bridge server (or a previously-registered one), returns the URL to open Isaac Sim\'s live viewport in Chrome — the real NVIDIA WebRTC streaming client URL (http://<host>:8211/streaming/webrtc-client?server=<host>), not a placeholder. ' +
    'This is deliberately simple — it just resolves the URL, it does not manage the WebRTC connection itself (that is a planned future skill). ' +
    'Note: Isaac Sim\'s WebRTC stream works reliably on the same network or over something like Tailscale; reaching it over the open internet needs STUN/TURN configuration on your end.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    webrtcPort: z.number().int().positive().default(8211).describe('Port Isaac Sim\'s WebRTC streaming client listens on — 8211 is the NVIDIA default, override if yours differs'),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    const host = new URL(serverUrl).hostname;
    const viewerUrl = `http://${host}:${input.webrtcPort}/streaming/webrtc-client?server=${host}`;

    // If the caller supplied a fresh serverUrl (not resolved from an
    // existing registration) and gave us enough to register it, do so as a
    // convenience — so the next "set up my Isaac Sim" for this
    // project/machine doesn't need the URL re-typed. Best-effort: never
    // fail the whole action over a registration hiccup.
    if (input.serverUrl && context.userId && input.projectId && input.machineId) {
      const { registerBridgeEndpoint } = await import('@/lib/db/bridge-endpoints');
      await registerBridgeEndpoint(context.userId, input.projectId, input.machineId, 'isaac_sim', serverUrl).catch(() => {});
    }

    return {
      viewerUrl,
      serverUrl,
      message: `Open ${viewerUrl} in Chrome to view your Isaac Sim viewport live.`,
    };
  },
};

export const startScenarioAction: AgentNativeAction = {
  id: 'upfreq.simulation.start_scenario',
  namespace: 'upfreq.simulation',
  name: 'start_scenario',
  description: 'Deploys a robot USD stage into a real, running NVIDIA Isaac Sim server and starts the scenario. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    robotName: z.string(),
    scenarioName: z.string().default('warehouse_navigation'),
    environment: z.enum(['grid', 'warehouse', 'hospital', 'outdoor_uneven', 'narrow_corridor']).default('grid'),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    await checkServerHealth(serverUrl, apiKey);
    const result = await bridgePost<{ webrtc_stream_url?: string }>(serverUrl, '/api/v1/scenario/start', {
      robot_name: input.robotName,
      scenario_name: input.scenarioName,
      environment: input.environment,
    }, apiKey);

    return {
      status: 'active',
      robotName: input.robotName,
      scenarioName: input.scenarioName,
      environment: input.environment,
      serverUrl,
      webrtcStreamUrl: result.webrtc_stream_url,
    };
  },
};

export const pauseSimulationAction: AgentNativeAction = {
  id: 'upfreq.simulation.pause_simulation',
  namespace: 'upfreq.simulation',
  name: 'pause_simulation',
  description: 'Freezes or resumes physics step execution and the master /clock on a real, running Isaac Sim server. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    paused: z.boolean().default(true),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    await bridgePost(serverUrl, '/api/v1/scenario/pause', { paused: input.paused }, apiKey);

    return {
      paused: input.paused,
      serverUrl,
      timestamp: new Date().toISOString(),
    };
  },
};

export const resetStageAction: AgentNativeAction = {
  id: 'upfreq.simulation.reset_stage',
  namespace: 'upfreq.simulation',
  name: 'reset_stage',
  description: 'Executes the 3-step Clean Scenario Reset (zero velocities, restore world poses, clear Nav2 costmaps) on a real, running Isaac Sim server. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    robotName: z.string().default('autonomous_robot'),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    return executeCleanResetProtocol(input.robotName, serverUrl, apiKey);
  },
};

export const getStageTelemetryAction: AgentNativeAction = {
  id: 'upfreq.simulation.get_stage_telemetry',
  namespace: 'upfreq.simulation',
  name: 'get_stage_telemetry',
  description: 'Retrieves live robot base pose, joint states, and the simulation /clock timestamp from a real, running Isaac Sim server. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    robotName: z.string().default('autonomous_robot'),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    const telemetry = await bridgeGet(serverUrl, `/api/v1/telemetry?robot_name=${encodeURIComponent(input.robotName)}`, apiKey);
    return { robotName: input.robotName, serverUrl, ...telemetry };
  },
};

export const simulationActions = [
  setupIsaacSimAction,
  startScenarioAction,
  pauseSimulationAction,
  resetStageAction,
  getStageTelemetryAction,
];
