import { z } from 'zod';

export const AssetContractSchema = z.object({
  asset: z.object({
    id: z.string(),
    version: z.string(),
    type: z.enum(['robot_mobile', 'robot_manipulator', 'environment', 'sensor']),
    visibility: z.enum(['public', 'private']).default('public'),
    description: z.string().optional(),
  }),
  runtime_requirements: z.object({
    ros_distribution: z.string().default('jazzy'),
    simulators_supported: z.array(z.record(z.string(), z.string())).default([]),
    gpu: z.object({
      min_vram_gb: z.number().default(8),
    }).optional(),
  }),
  dependencies: z.object({
    ros_packages: z.array(z.string()).default([]),
  }),
  interfaces: z.object({
    command: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })).default([]),
    state: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })).default([]),
  }),
  frames: z.object({
    root: z.string().default('base_footprint'),
    required: z.array(z.string()).default([]),
  }),
  simulation_profile: z.object({
    mass_kg: z.number().optional(),
    drive_type: z.string().optional(),
    max_linear_velocity: z.number().optional(),
    max_angular_velocity: z.number().optional(),
  }).optional(),
  validation: z.object({
    status: z.enum(['verified', 'unverified', 'failed']).default('unverified'),
    validator_version: z.string().default('1.2.0'),
    physics_score: z.number().min(0).max(100).default(80),
  }).optional(),
});

export type AssetContract = z.infer<typeof AssetContractSchema>;

export function validateAssetContract(data: unknown): { valid: boolean; contract?: AssetContract; error?: string } {
  const result = AssetContractSchema.safeParse(data);
  if (!result.success) {
    const issues = (result.error as any).issues || (result.error as any).errors || [];
    return {
      valid: false,
      error: issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', '),
    };
  }
  return { valid: true, contract: result.data };
}
