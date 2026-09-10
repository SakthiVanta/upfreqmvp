export interface InertiaTensor {
  ixx: number;
  ixy: number;
  ixz: number;
  iyy: number;
  iyz: number;
  izz: number;
}

export interface LinkValidationResult {
  linkName: string;
  mass: number;
  inertiaValid: boolean;
  triangleInequalityValid: boolean;
  positiveDefinite: boolean;
  issues: string[];
  suggestedInertia?: InertiaTensor;
}

export interface PreflightCompilerOptions {
  robotName?: string;
  targetEngine?: 'isaac_sim' | 'newton_physics' | 'both';
  metersPerUnit?: number;
  upAxis?: 'Z' | 'Y';
  enableVhacdDecomposition?: boolean;
  replaceHardwareInterface?: boolean;
  simulationPluginName?: string; // e.g. "upfreq_simulation_hardware"
}

export interface PreflightCompilerResult {
  success: boolean;
  confidenceScore: number; // 0 to 100
  robotName: string;
  openUsdContent: string; // Canonical OpenUSD .usda stage
  simulationOverrideUrdf: string; // Non-destructive simulation override URDF
  linkValidations: LinkValidationResult[];
  issues: string[];
  warnings: string[];
  resolvedPackages: Record<string, string>;
  hardwareInterfaceSubstituted: boolean;
  generatedAt: string;
}
