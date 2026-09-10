import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { OPEN_SOURCE_ENVIRONMENTS } from '@/lib/testing/open-source-environments';

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
  description: 'Selects and deploys a simulation environment stage (e.g. warehouse, hospital, grid) in Isaac Sim.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    environmentKey: z.string().default('warehouse'),
    robotName: z.string().default('warehouse_amr'),
  }),
  async execute(input) {
    const meta = OPEN_SOURCE_ENVIRONMENTS.find(e => e.id === input.environmentKey) || OPEN_SOURCE_ENVIRONMENTS[0];
    return {
      success: true,
      environmentKey: meta.id,
      name: meta.name,
      dimensions: meta.dimensions,
      robotName: input.robotName,
      message: `Environment "${meta.name}" selected and staged for ${input.robotName} in Isaac Sim.`,
    };
  },
};

export const environmentActions = [
  listEnvironmentsAction,
  selectEnvironmentAction,
];
