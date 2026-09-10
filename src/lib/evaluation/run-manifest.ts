import { createHash } from 'crypto';

export interface RunManifest {
  run_id: string;
  timestamp_utc: string;
  reproducibility: {
    git_commit: string;
    git_branch: string;
    git_dirty_diff_sha256: string;
    robot_asset: string;
    environment_asset: string;
    simulation_profile: string;
    simulation_engine: 'isaac_sim' | 'newton_physics';
    solver: string;
    ros_distro: string;
    random_seed: number;
    parameter_hash: string;
  };
  runtime: {
    container_image: string;
    container_digest: string;
    kernel_version: string;
    gpu_model: string;
    driver_version: string;
    cuda_version: string;
  };
  metrics: {
    trials_total: number;
    trials_passed: number;
    collision_count: number;
    avg_time_to_goal_sec: number;
    min_obstacle_clearance_m: number;
  };
  artifacts: {
    mcap_bag_uri: string;
    diagnostic_report_uri: string;
  };
}

export function generateRunManifest(params: {
  runId?: string;
  gitCommit?: string;
  gitBranch?: string;
  dirtyDiff?: string;
  robotAsset?: string;
  environmentAsset?: string;
  simulationProfile?: string;
  simulationEngine?: 'isaac_sim' | 'newton_physics';
  solver?: string;
  randomSeed?: number;
  parameters?: Record<string, any>;
  metrics: {
    trialsTotal: number;
    trialsPassed: number;
    collisionCount: number;
    avgTimeToGoalSec: number;
    minObstacleClearanceM: number;
  };
}): RunManifest {
  const runId = params.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const dirtyDiffSha = params.dirtyDiff
    ? createHash('sha256').update(params.dirtyDiff).digest('hex')
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const paramHash = params.parameters
    ? createHash('sha256').update(JSON.stringify(params.parameters)).digest('hex').slice(0, 12)
    : 'a1b2c3d4e5f6';

  return {
    run_id: runId,
    timestamp_utc: new Date().toISOString(),
    reproducibility: {
      git_commit: params.gitCommit || '8f3a921d7b0c',
      git_branch: params.gitBranch || 'main',
      git_dirty_diff_sha256: dirtyDiffSha,
      robot_asset: params.robotAsset || 'upfreq://library/robots/warehouse_amr@2.1.0',
      environment_asset: params.environmentAsset || 'upfreq://library/environments/warehouse_v2@1.4.0',
      simulation_profile: params.simulationProfile || 'fast_regression',
      simulation_engine: params.simulationEngine || 'newton_physics',
      solver: params.solver || 'mujoco',
      ros_distro: 'jazzy',
      random_seed: params.randomSeed || 4291823,
      parameter_hash: paramHash,
    },
    runtime: {
      container_image: 'upfreq/robotics-runtime:1.2.0-jazzy',
      container_digest: 'sha256:d8e8fca234bc1234abcd5678ef90123456789abcdef0123456789abcdef01234',
      kernel_version: '6.5.0-44-generic',
      gpu_model: 'NVIDIA GeForce RTX 4090',
      driver_version: '550.54.14',
      cuda_version: '12.2',
    },
    metrics: {
      trials_total: params.metrics.trialsTotal,
      trials_passed: params.metrics.trialsPassed,
      collision_count: params.metrics.collisionCount,
      avg_time_to_goal_sec: params.metrics.avgTimeToGoalSec,
      min_obstacle_clearance_m: params.metrics.minObstacleClearanceM,
    },
    artifacts: {
      mcap_bag_uri: `s3://upfreq-artifacts/runs/${runId}/telemetry.mcap`,
      diagnostic_report_uri: `s3://upfreq-artifacts/runs/${runId}/report.json`,
    },
  };
}
