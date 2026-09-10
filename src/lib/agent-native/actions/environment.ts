import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { OPEN_SOURCE_ENVIRONMENTS } from '@/lib/testing/open-source-environments';
import { resolveBridgeServerUrl, bridgePost } from './bridge-http';

export const listEnvironmentsAction: AgentNativeAction = {
  id: 'upfreq.environment.list_environments',
  namespace: 'upfreq.simulation',
  name: 'list_environments',
  description: 'Lists all available open-source and canonical simulation environments for NVIDIA Isaac Sim.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({}),
  async execute() {
    const envs = OPEN_SOURCE_ENVIRONMENTS.map((meta) => ({
      presetKey: meta.id,
      name: meta.name,
      category: meta.category,
      tagline: meta.tagline,
      sourcePackage: meta.sourcePackage,
      dimensions: meta.dimensions,
      obstacleDensity: meta.obstacleDensity,
      openSourceRepo: meta.openSourceRepo,
    }));

    return {
      count: envs.length,
      environments: envs,
    };
  },
};

export const selectEnvironmentAction: AgentNativeAction = {
  id: 'upfreq.environment.select_environment',
  namespace: 'upfreq.simulation',
  name: 'select_environment',
  description: 'Selects and stages a simulation environment (e.g. warehouse, hospital, grid) on a real, running Isaac Sim server. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    environmentKey: z.string().default('warehouse'),
    robotName: z.string().default('warehouse_amr'),
    serverUrl: z.string().url().optional().describe('Base URL of the Isaac Sim bridge server. Omit if a bridge endpoint is already registered for this projectId/machineId.'),
    apiKey: z.string().optional(),
    projectId: z.string().optional(),
    machineId: z.string().optional(),
  }),
  async execute(input, context) {
    const meta = OPEN_SOURCE_ENVIRONMENTS.find(e => e.id === input.environmentKey) || OPEN_SOURCE_ENVIRONMENTS[0];
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);

    await bridgePost(serverUrl, '/api/v1/scenario/select-environment', {
      environment_key: meta.id,
      robot_name: input.robotName,
    }, apiKey);

    return {
      success: true,
      environmentKey: meta.id,
      name: meta.name,
      dimensions: meta.dimensions,
      robotName: input.robotName,
      serverUrl,
      message: `Environment "${meta.name}" selected and staged for ${input.robotName} in Isaac Sim.`,
    };
  },
};

export const environmentActions = [
  listEnvironmentsAction,
  selectEnvironmentAction,
];
