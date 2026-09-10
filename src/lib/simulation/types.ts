export type SimulationEngineType = 'isaac_sim' | 'newton_physics';
export type PhysicsSolverType = 'physx5' | 'mujoco' | 'warp_differentiable' | 'kamino';

export interface SimulationProfileConfig {
  profileKey: string;
  name: string;
  engine: SimulationEngineType;
  physicsSolver: PhysicsSolverType;
  physicsDt: number; // in seconds, e.g. 0.016666 (60Hz) or 0.02 (50Hz)
  rendering: 'interactive_rtx' | 'headless_disabled';
  targetRtf: number; // 1.0 (Isaac) to 100.0-200.0 (Newton)
  differentiable?: boolean;
  sensorsEnabled: string[]; // e.g. ['lidar', 'camera', 'imu'] or ['proximity_raycast', 'odom', 'imu']
  description: string;
}

export interface DifferentiableTuningTarget {
  parameterName: 'wheel_friction' | 'controller_kp' | 'controller_kd' | 'wheel_damping' | 'center_of_mass_z';
  initialValue: number;
  learningRate: number;
  minValue: number;
  maxValue: number;
  unit: string;
}

export interface DifferentiableTuningResult {
  parameterName: string;
  initialValue: number;
  optimizedValue: number;
  initialLoss: number;
  finalLoss: number;
  lossHistory: number[];
  gradientHistory: number[];
  iterations: number;
  converged: boolean;
  durationMs: number;
}

export interface NewtonTrialRun {
  trialIndex: number;
  seed: number;
  status: 'passed' | 'failed' | 'collision';
  timeToGoalSec: number;
  minClearanceMeters: number;
  maxVelocityMs: number;
  pathSmoothnessScore: number;
  logs: string[];
}

export interface NewtonBatchRegressionResult {
  totalTrials: number;
  passedTrials: number;
  failedTrials: number;
  collisions: number;
  realTimeFactor: number;
  totalDurationMs: number;
  avgTimeToGoalSec: number;
  minObstacleClearanceM: number;
  paretoPassRate: number; // 0 to 1.0
  trials: NewtonTrialRun[];
  engine: 'newton_physics';
  solver: PhysicsSolverType;
}
