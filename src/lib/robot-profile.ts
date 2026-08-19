export interface DetailedSensorParam {
  label: string;
  value: string;
  unit?: string;
  category: string;
}

export interface SensorRecord {
  id: string;
  name: string;
  type: string;
  linkName: string;
  parentLink: string;
  /** Null when the real joint origin couldn't be resolved from the repo — no fallback coordinates, ever. */
  position: { x: number; y: number; z: number } | null;
  orientation: { r: number; p: number; y: number } | null;
  frameId: string;
  collisionType?: string;
  mass?: number;
  detailedParams?: DetailedSensorParam[];
  /** Raw GitHub URL to the sensor's real .stl mesh, resolved from the repo's own URDF — null/absent means no matching STL was found and the 3D viewer should fall back to primitive geometry instead of a stand-in mesh. */
  meshUrl?: string | null;
  sourceFile?: string;
  /** True when this sensor's position/orientation could not be confidently resolved from the repo — position/orientation above are null, not a placeholder. */
  estimated?: boolean;
}

export interface DataFlowNode {
  id: string;
  label: string;
  type: 'sensor' | 'driver' | 'preprocessing' | 'estimation' | 'autonomy_module' | 'control';
  rosTopic?: string;
  rosMessageType?: string;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  label?: string;
  rosTopic?: string;
}

export interface AutonomyModuleClassification {
  name: 'SLAM' | 'Localization' | 'Navigation' | 'Path Planning' | 'Obstacle Avoidance' | 'Perception' | 'Control' | 'Sensor Fusion';
  status: 'Implemented in Codebase' | 'Configured via Launch/YAML' | 'Missing / Unreferenced';
  nodeName: string;
  packageSource: string;
  evidence: string;
  configFiles: string[];
}

export interface Nav2ConfigRecord {
  module: string;
  packageProvider: string;
  launchFile: string;
  configYaml: string;
  primaryNode: string;
  description: string;
  parameters?: { key: string; value: string; category: string }[];
}

export interface EnvironmentConfig {
  name: string;
  type: string;
  worldFile: string;
  physicsEngine: string;
  timeStepSec: number;
  gravity: [number, number, number];
  description: string;
}

export interface ExternalRepoDependency {
  repoName: string;
  url: string;
  purpose: string;
  requiredFor: string;
}

export interface TestCaseRecord {
  id: string;
  name: string;
  type: 'Kinematic' | 'Sensor' | 'Nav2' | 'IsaacSim';
  description: string;
  testScript: string;
  passCriteria: string;
}

export interface PackageRecord {
  name: string;
  version: string;
  description: string;
  buildType: string;
  dependencies: string[];
  folderPath: string;
}

export interface RobotProfile {
  id: string;
  name: string;
  repoUrl: string;
  rosVersion: string;
  description: string;
  /** Every discovered package.xml manifest in the repo, real parsed name/version/dependencies — not just the ones used as autonomy-module evidence. */
  packages: PackageRecord[];
  /** Every field is null unless it was actually resolved from the repo — no
   * fallback numbers, not even zero. UI must render "Not determined" for
   * null fields rather than substitute a guess. */
  chassis: {
    length: number | null;
    width: number | null;
    height: number | null;
    wheelbase: number | null;
    wheelRadius: number | null;
    totalMassKg: number | null;
    centerOfGravity: { x: number; y: number; z: number } | null;
    inertia: { ixx: number; iyy: number; izz: number } | null;
    maxSpeedLinearMs: number | null;
    maxSpeedAngularRads: number | null;
  };
  sensors: SensorRecord[];
  gazeboPlugins: Array<{
    name: string;
    targetLink: string;
    sensorType: string;
    pluginSystem: string;
    updateRateHz?: number;
    gzTopic?: string;
    rosTopic: string;
    rosMessageType: string;
  }>;
  topics: Array<{
    topic: string;
    type: string;
    direction: 'Publisher' | 'Subscriber' | 'Bridge';
    nodeOwner: string;
    description: string;
  }>;
  sensorToModuleMappings: Array<{
    sensorName: string;
    sensorType: string;
    outputTopic: string;
    consumerNodes: string[];
    processingStage: string;
    targetAutonomyModule: string;
  }>;
  dataFlowPipeline: {
    nodes: DataFlowNode[];
    edges: DataFlowEdge[];
  };
  autonomyModules: AutonomyModuleClassification[];
  navigationStack: Nav2ConfigRecord[];
  environments: EnvironmentConfig[];
  externalDependencies: ExternalRepoDependency[];
  testCases: TestCaseRecord[];
  launchFiles: string[];
  yamlConfigFiles: string[];
  diagnosticsNotice: string;
  /** True when no LiDAR/camera/IMU joints could be pattern-matched (or the agent found none) — sensors is genuinely empty, not backfilled with a placeholder. */
  noSensorsDetected?: boolean;
  /** True when the real Gemini agentic tool-use analysis produced this profile; false/absent means the deterministic regex fallback parser ran instead (Gemini unavailable). */
  usedAgenticAnalysis?: boolean;
  agentReasoningSummary?: string | null;
  /** Names of chassis fields below that are engineering estimates rather than values extracted from the repo. */
  chassisEstimatedFields?: string[];
}

// Standard solid-box moment of inertia approximation — only ever computed
// when real mass AND real dimensions are all present; if any input is
// unknown, the result is unknown too (null), never a guess built on a guess.
function computeBoxInertia(massKg: number | null, length: number | null, width: number | null, height: number | null) {
  if (massKg == null || length == null || width == null || height == null) return null;
  return {
    ixx: +((1 / 12) * massKg * (width ** 2 + height ** 2)).toFixed(6),
    iyy: +((1 / 12) * massKg * (length ** 2 + height ** 2)).toFixed(6),
    izz: +((1 / 12) * massKg * (length ** 2 + width ** 2)).toFixed(6),
  };
}

// Dynamic Profile Generator constructed live from any ingested GitHub repository
export function createDynamicRobotProfileFromUrl(repoUrl: string, parsedData?: any): RobotProfile {
  const repoName = repoUrl.split('/').pop() || 'robotics_repo';
  const cleanName = repoName.charAt(0).toUpperCase() + repoName.slice(1);

  // No static per-robot fallbacks here on purpose: if a field wasn't
  // actually produced by a real analysis (agentic or regex), it defaults to
  // empty/unknown, never to another robot's specs dressed up as this one's.
  const sensors: SensorRecord[] = parsedData?.sensors ?? [];
  const sensorToModuleMappings = parsedData?.sensorToModuleMappings ?? [];
  const dataFlowPipeline = parsedData?.dataFlowPipeline ?? { nodes: [], edges: [] };
  const autonomyModules: AutonomyModuleClassification[] = parsedData?.autonomyModules ?? [];

  return {
    id: repoName.toLowerCase(),
    name: cleanName,
    repoUrl,
    rosVersion: parsedData?.rosVersion || 'ROS 2 Humble / Iron / Rolling',
    description: parsedData?.description || `Dynamically audited ROS 2 repository from ${repoUrl}`,
    packages: parsedData?.packages ?? [],
    // No fallback numbers, not even zero — a field is either a real value
    // resolved from this repo, or null. `chassisEstimatedFields` (below)
    // is what route.ts uses to strip the agent's own "best guess" numbers
    // down to null before they ever reach here.
    chassis: {
      length: parsedData?.chassis?.length ?? null,
      width: parsedData?.chassis?.width ?? null,
      height: parsedData?.chassis?.height ?? null,
      wheelbase: parsedData?.chassis?.wheelbase ?? null,
      wheelRadius: parsedData?.chassis?.wheelRadius ?? null,
      totalMassKg: parsedData?.chassis?.totalMassKg ?? null,
      centerOfGravity: parsedData?.chassis?.centerOfGravity ?? null,
      inertia: parsedData?.chassis?.inertia ?? computeBoxInertia(
        parsedData?.chassis?.totalMassKg ?? null,
        parsedData?.chassis?.length ?? null,
        parsedData?.chassis?.width ?? null,
        parsedData?.chassis?.height ?? null
      ),
      maxSpeedLinearMs: parsedData?.chassis?.maxSpeedLinearMs ?? null,
      maxSpeedAngularRads: parsedData?.chassis?.maxSpeedAngularRads ?? null,
    },
    sensors,
    gazeboPlugins: parsedData?.gazeboPlugins ?? [],
    topics: parsedData?.topics ?? [],
    sensorToModuleMappings,
    dataFlowPipeline,
    autonomyModules,
    navigationStack: parsedData?.navigationStack ?? [],
    environments: parsedData?.environments ?? [],
    externalDependencies: parsedData?.externalDependencies ?? [],
    testCases: parsedData?.testCases ?? [],
    launchFiles: parsedData?.launchFiles ?? [],
    yamlConfigFiles: parsedData?.yamlConfigFiles ?? [],
    diagnosticsNotice: parsedData?.diagnosticsNotice || (parsedData ? `Analyzed '${repoUrl}'.` : `No analysis has been run yet for '${repoUrl}'.`),
    noSensorsDetected: parsedData?.noSensorsDetected ?? !parsedData,
    usedAgenticAnalysis: parsedData?.usedAgenticAnalysis ?? false,
    agentReasoningSummary: parsedData?.agentReasoningSummary ?? null,
    // Derived directly from which chassis fields are actually null, so this
    // can never drift out of sync with the chassis object above.
    chassisEstimatedFields: (['length', 'width', 'height', 'wheelbase', 'wheelRadius', 'totalMassKg', 'centerOfGravity', 'inertia', 'maxSpeedLinearMs', 'maxSpeedAngularRads'] as const)
      .filter(f => (parsedData?.chassis?.[f] ?? null) === null),
  };
}
