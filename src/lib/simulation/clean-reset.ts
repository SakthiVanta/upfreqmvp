import { bridgePost } from '@/lib/agent-native/actions/bridge-http';

/**
 * Clean Scenario Reset Protocol
 *
 * 3-Step Reset Sequence, dispatched as one call to a real Isaac Sim bridge
 * server's /api/v1/scenario/reset — the server is expected to perform all
 * three steps and report which ones actually completed:
 * Step 1: Physics freeze & zero joint velocities
 * Step 2: Reset world poses of robot base and dynamic obstacle meshes
 * Step 3: Clear ROS 2 / Nav2 costmaps and reset local planner states
 */

export interface CleanResetResult {
  success: boolean;
  step1PhysicsZeroed: boolean;
  step2WorldPosesReset: boolean;
  step3CostmapsCleared: boolean;
  timestamp: string;
  logs: string[];
}

interface CleanResetServerResponse {
  step1_physics_zeroed?: boolean;
  step2_world_poses_reset?: boolean;
  step3_costmaps_cleared?: boolean;
  logs?: string[];
}

export async function executeCleanResetProtocol(
  robotName: string,
  serverUrl: string,
  apiKey?: string
): Promise<CleanResetResult> {
  const result = await bridgePost<CleanResetServerResponse>(serverUrl, '/api/v1/scenario/reset', { robot_name: robotName }, apiKey);

  const step1 = result.step1_physics_zeroed ?? false;
  const step2 = result.step2_world_poses_reset ?? false;
  const step3 = result.step3_costmaps_cleared ?? false;

  return {
    success: step1 && step2 && step3,
    step1PhysicsZeroed: step1,
    step2WorldPosesReset: step2,
    step3CostmapsCleared: step3,
    timestamp: new Date().toISOString(),
    logs: result.logs || [],
  };
}
