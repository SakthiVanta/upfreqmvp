import { SimulationProfileConfig } from './types';

export const CANONICAL_SIMULATION_PROFILES: Record<string, SimulationProfileConfig> = {
  interactive_inspect: {
    profileKey: 'interactive_inspect',
    name: 'Interactive Visual Debug (Isaac Sim)',
    engine: 'isaac_sim',
    physicsSolver: 'physx5',
    physicsDt: 0.016666, // 60 Hz
    rendering: 'interactive_rtx',
    targetRtf: 1.0,
    sensorsEnabled: ['lidar', 'camera', 'imu'],
    description: 'Interactive visual debugging with WebRTC viewport stream and RTX raytraced sensors.',
  },

  fast_regression: {
    profileKey: 'fast_regression',
    name: 'Fast Headless Regression (Newton Physics)',
    engine: 'newton_physics',
    physicsSolver: 'mujoco',
    physicsDt: 0.02, // 50 Hz
    rendering: 'headless_disabled',
    targetRtf: 100.0,
    sensorsEnabled: ['proximity_raycast', 'odom', 'imu'],
    description: 'Ultra-fast headless regression test via NVIDIA Warp / MuJoCo (<1s cold boot, 50x-200x RTF).',
  },

  differentiable_tuning: {
    profileKey: 'differentiable_tuning',
    name: 'Differentiable System ID (Newton Warp)',
    engine: 'newton_physics',
    physicsSolver: 'warp_differentiable',
    physicsDt: 0.01, // 100 Hz
    rendering: 'headless_disabled',
    targetRtf: 50.0,
    differentiable: true,
    sensorsEnabled: ['odom', 'imu', 'joint_encoders'],
    description: 'Analytical gradient descent for physical parameter calibration (friction, PID, inertia).',
  },
};

export function getSimulationProfile(key: string): SimulationProfileConfig {
  return CANONICAL_SIMULATION_PROFILES[key] || CANONICAL_SIMULATION_PROFILES.fast_regression;
}

export function listSimulationProfiles(): SimulationProfileConfig[] {
  return Object.values(CANONICAL_SIMULATION_PROFILES);
}
