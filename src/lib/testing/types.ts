export type TestCategory =
  | 'kinematics'
  | 'velocity_braking'
  | 'collision_avoidance'
  | 'incline_stability'
  | 'payload_capacity'
  | 'custom';

export type SimEnvironmentPreset =
  | 'grid'
  | 'warehouse'
  | 'laboratory'
  | 'incline_slope'
  | 'rough_terrain'
  | 'empty';

export interface TestAssertion {
  id: string;
  label: string;
  metric: string;
  operator: '>=' | '<=' | '==' | '<' | '>';
  targetValue: number;
  unit: string;
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actualValue: number;
  message: string;
}

export interface TestExecutionRecord {
  status: 'passed' | 'failed' | 'running' | 'idle';
  executedAt: string;
  durationMs: number;
  recordedMetrics: Record<string, number>;
  assertionResults: AssertionResult[];
  logs: string[];
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  environment: SimEnvironmentPreset;
  durationSec: number;
  commandType: 'joint_sweep' | 'velocity_step' | 'emergency_stop' | 'incline_drive' | 'custom_script';
  commandParams: {
    targetVelocity?: number;
    targetJoints?: Record<string, number>;
    slopeAngleDeg?: number;
    obstacleDistanceM?: number;
    payloadMassKg?: number;
  };
  assertions: TestAssertion[];
  lastRun?: TestExecutionRecord;
}

export interface SimStageConfig {
  environment: SimEnvironmentPreset;
  gravityZ: number;
  groundFriction: number;
  ambientLighting: 'studio' | 'warehouse_fluorescent' | 'outdoor_sun';
}
