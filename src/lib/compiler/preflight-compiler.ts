import {
  PreflightCompilerOptions,
  PreflightCompilerResult,
  LinkValidationResult,
  InertiaTensor,
} from './types';
import { adaptRos2ControlToSimulation } from './ros2-control-adapter';

// Deterministically calculate analytical inertia for standard geometries
export function calculateAnalyticalInertia(
  geometry: { type: 'box'; x: number; y: number; z: number } |
            { type: 'cylinder'; radius: number; length: number } |
            { type: 'sphere'; radius: number },
  mass: number
): InertiaTensor {
  if (mass <= 0) mass = 1.0;

  if (geometry.type === 'box') {
    const { x, y, z } = geometry;
    return {
      ixx: (1 / 12) * mass * (y * y + z * z),
      ixy: 0,
      ixz: 0,
      iyy: (1 / 12) * mass * (x * x + z * z),
      iyz: 0,
      izz: (1 / 12) * mass * (x * x + y * y),
    };
  }

  if (geometry.type === 'cylinder') {
    const { radius, length } = geometry;
    const iRadial = (1 / 12) * mass * (3 * radius * radius + length * length);
    const iAxial = 0.5 * mass * radius * radius;
    return {
      ixx: iRadial,
      ixy: 0,
      ixz: 0,
      iyy: iRadial,
      iyz: 0,
      izz: iAxial,
    };
  }

  // Sphere
  const { radius } = geometry;
  const iSphere = (2 / 5) * mass * radius * radius;
  return {
    ixx: iSphere,
    ixy: 0,
    ixz: 0,
    iyy: iSphere,
    iyz: 0,
    izz: iSphere,
  };
}

// Apply Parallel Axis Theorem to shift inertia tensor: I = I_cm + m * (d^2 * E - d * d^T)
export function applyParallelAxisTheorem(
  iCm: InertiaTensor,
  mass: number,
  offset: { x: number; y: number; z: number }
): InertiaTensor {
  const { x, y, z } = offset;
  const d2 = x * x + y * y + z * z;

  return {
    ixx: iCm.ixx + mass * (d2 - x * x),
    ixy: iCm.ixy - mass * (x * y),
    ixz: iCm.ixz - mass * (x * z),
    iyy: iCm.iyy + mass * (d2 - y * y),
    iyz: iCm.iyz - mass * (y * z),
    izz: iCm.izz + mass * (d2 - z * z),
  };
}

// Verify positive definiteness and triangle inequality for inertia tensor
export function validateInertiaTensor(inertia: InertiaTensor): {
  positiveDefinite: boolean;
  triangleInequalityValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  const { ixx, ixy, ixz, iyy, iyz, izz } = inertia;

  // 1. Positive principal moments
  if (ixx <= 0 || iyy <= 0 || izz <= 0) {
    issues.push(`Principal moments must be strictly positive (ixx=${ixx.toFixed(4)}, iyy=${iyy.toFixed(4)}, izz=${izz.toFixed(4)})`);
  }

  // 2. Triangle inequalities: sum of any two principal moments must be >= the third
  const t1 = ixx + iyy >= izz - 1e-6;
  const t2 = ixx + izz >= iyy - 1e-6;
  const t3 = iyy + izz >= ixx - 1e-6;
  const triangleInequalityValid = t1 && t2 && t3;

  if (!triangleInequalityValid) {
    issues.push(`Inertia violates triangle inequalities: ixx+iyy>=izz (${t1}), ixx+izz>=iyy (${t2}), iyy+izz>=ixx (${t3})`);
  }

  // 3. Positive definiteness via Sylvester's criterion on symmetric matrix:
  // [ ixx  ixy  ixz ]
  // [ ixy  iyy  iyz ]
  // [ ixz  iyz  izz ]
  const det1 = ixx;
  const det2 = ixx * iyy - ixy * ixy;
  const det3 =
    ixx * (iyy * izz - iyz * iyz) -
    ixy * (ixy * izz - iyz * ixz) +
    ixz * (ixy * iyz - iyy * ixz);

  const positiveDefinite = det1 > 0 && det2 > 0 && det3 > 0;
  if (!positiveDefinite) {
    issues.push(`Inertia matrix is not positive-definite (determinants: d1=${det1.toFixed(3)}, d2=${det2.toFixed(3)}, d3=${det3.toFixed(3)})`);
  }

  return {
    positiveDefinite,
    triangleInequalityValid,
    issues,
  };
}

// Scrape and resolve launch arguments & xacro substitutions
export function resolveXacroSubstitutions(content: string, args: Record<string, string> = {}): string {
  let resolved = content;

  // Replace $(arg var_name)
  resolved = resolved.replace(/\$\(arg\s+([a-zA-Z0-9_]+)\)/g, (match, argName) => {
    return args[argName] !== undefined ? args[argName] : match;
  });

  // Extract <xacro:property name="..." value="..."/>
  const propMatches = content.matchAll(/<xacro:property\s+name=["']([^"']+)["']\s+value=["']([^"']+)["']\s*\/?>/g);
  const properties: Record<string, string> = {};
  for (const p of propMatches) {
    properties[p[1]] = p[2];
  }

  // Substitute ${prop}
  for (const [k, v] of Object.entries(properties)) {
    const pattern = new RegExp(`\\$\\{${k}\\}`, 'g');
    resolved = resolved.replace(pattern, v);
  }

  return resolved;
}

// Convert URDF to Canonical OpenUSD (.usda) scene representation
export function generateCanonicalOpenUsd(
  robotName: string,
  urdfXml: string,
  linkValidations: LinkValidationResult[],
  options: PreflightCompilerOptions = {}
): string {
  const metersPerUnit = options.metersPerUnit ?? 1.0;
  const upAxis = options.upAxis ?? 'Z';

  // Parse links from URDF
  const linkNames: string[] = [];
  const linkMatches = urdfXml.matchAll(/<link\s+name=["']([^"']+)["']/g);
  for (const m of linkMatches) {
    if (!linkNames.includes(m[1])) linkNames.push(m[1]);
  }

  // Parse joints from URDF
  interface ParsedJoint {
    name: string;
    type: string;
    parent: string;
    child: string;
    xyz: string;
    rpy: string;
  }
  const joints: ParsedJoint[] = [];
  const jointMatches = urdfXml.matchAll(/<joint\s+name=["']([^"']+)["']\s+type=["']([^"']+)["']>([\s\S]*?)<\/joint>/g);

  for (const jm of jointMatches) {
    const jName = jm[1];
    const jType = jm[2];
    const jBody = jm[3];

    const parentMatch = jBody.match(/<parent\s+link=["']([^"']+)["']/);
    const childMatch = jBody.match(/<child\s+link=["']([^"']+)["']/);
    const originMatch = jBody.match(/<origin\s+(?:xyz=["']([^"']+)["'])?(?:\s+rpy=["']([^"']+)["'])?/);

    if (parentMatch && childMatch) {
      joints.push({
        name: jName,
        type: jType,
        parent: parentMatch[1],
        child: childMatch[1],
        xyz: originMatch?.[1] || '0 0 0',
        rpy: originMatch?.[2] || '0 0 0',
      });
    }
  }

  const cleanRobotName = robotName.replace(/[^a-zA-Z0-9_]/g, '_') || 'UpFreqRobot';

  // Build USDA text
  let usda = `#usda 1.0
(
    defaultPrim = "${cleanRobotName}"
    metersPerUnit = ${metersPerUnit.toFixed(1)}
    upAxis = "${upAxis}"
    doc = "Generated by UpFreq Robot Preflight Compiler (Canonical OpenUSD Scene Layer)"
)

def Xform "${cleanRobotName}" (
    apiSchemas = ["PhysicsArticulationRootAPI"]
)
{
    bool physics:articulationEnabled = true
`;

  // Links definitions
  for (const linkName of linkNames) {
    const val = linkValidations.find(v => v.linkName === linkName);
    const mass = val?.mass || 1.0;
    const inertia = val?.suggestedInertia || { ixx: 0.01, ixy: 0, ixz: 0, iyy: 0.01, iyz: 0, izz: 0.01 };
    const cleanLinkName = linkName.replace(/[^a-zA-Z0-9_]/g, '_');

    usda += `
    def Xform "${cleanLinkName}" (
        apiSchemas = ["PhysicsRigidBodyAPI", "PhysicsMassAPI"]
    )
    {
        bool physics:rigidBodyEnabled = true
        float physics:mass = ${mass.toFixed(4)}
        float3 physics:centerOfMass = (0, 0, 0)
        float3 physics:diagonalInertia = (${inertia.ixx.toFixed(6)}, ${inertia.iyy.toFixed(6)}, ${inertia.izz.toFixed(6)})
        
        def Mesh "collision_hull" (
            apiSchemas = ["PhysicsCollisionAPI"]
        )
        {
            bool physics:collisionEnabled = true
            uniform token physics:approximation = "${options.enableVhacdDecomposition ? 'convexDecomposition' : 'convexHull'}"
        }
    }
`;
  }

  // Joints definitions
  for (const joint of joints) {
    const cleanJointName = joint.name.replace(/[^a-zA-Z0-9_]/g, '_');
    const cleanParent = joint.parent.replace(/[^a-zA-Z0-9_]/g, '_');
    const cleanChild = joint.child.replace(/[^a-zA-Z0-9_]/g, '_');

    const [ox, oy, oz] = joint.xyz.split(' ').map(Number);

    let jointTypeSchema = 'PhysicsFixedJoint';
    if (joint.type === 'revolute' || joint.type === 'continuous') {
      jointTypeSchema = 'PhysicsRevoluteJoint';
    } else if (joint.type === 'prismatic') {
      jointTypeSchema = 'PhysicsPrismaticJoint';
    }

    usda += `
    def ${jointTypeSchema} "${cleanJointName}"
    {
        rel physics:body0 = </${cleanRobotName}/${cleanParent}>
        rel physics:body1 = </${cleanRobotName}/${cleanChild}>
        point3f physics:localPos0 = (${(ox || 0).toFixed(4)}, ${(oy || 0).toFixed(4)}, ${(oz || 0).toFixed(4)})
        quatf physics:localRot0 = (1, 0, 0, 0)
        point3f physics:localPos1 = (0, 0, 0)
        quatf physics:localRot1 = (1, 0, 0, 0)
        uniform token physics:axis = "Z"
    }
`;
  }

  usda += `}\n`;
  return usda;
}

/**
 * Executes the complete Preflight Compiler pipeline.
 * Translates unverified URDF/Xacro into simulation-ready OpenUSD and simulation overrides.
 */
export function compilePreflight(
  urdfOrXacro: string,
  options: PreflightCompilerOptions = {}
): PreflightCompilerResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const linkValidations: LinkValidationResult[] = [];
  const resolvedPackages: Record<string, string> = {};

  const robotNameMatch = urdfOrXacro.match(/<robot\s+name=["']([^"']+)["']/);
  const robotName = options.robotName || robotNameMatch?.[1] || 'autonomous_robot';

  // 1. Resolve Xacro substitutions
  const resolvedUrdf = resolveXacroSubstitutions(urdfOrXacro);

  // 2. Package URI Resolver
  const packageMatches = resolvedUrdf.matchAll(/package:\/\/([a-zA-Z0-9_]+)\/([^\s"'<]+)/g);
  for (const m of packageMatches) {
    const pkg = m[1];
    const relPath = m[2];
    resolvedPackages[pkg] = `/assets/robots/${pkg}`;
  }

  // 3. Structural & Inertia Validation per link
  const linkBlocks = resolvedUrdf.matchAll(/<link\s+name=["']([^"']+)["']>([\s\S]*?)<\/link>/g);
  let totalMass = 0;
  let validLinkCount = 0;
  let totalLinkCount = 0;

  for (const lb of linkBlocks) {
    totalLinkCount++;
    const linkName = lb[1];
    const linkBody = lb[2];

    const massMatch = linkBody.match(/<mass\s+value=["']([^"']+)["']/);
    const mass = massMatch ? parseFloat(massMatch[1]) : 0;

    const inertiaMatch = linkBody.match(
      /<inertia\s+ixx=["']([^"']+)["']\s+ixy=["']([^"']+)["']\s+ixz=["']([^"']+)["']\s+iyy=["']([^"']+)["']\s+iyz=["']([^"']+)["']\s+izz=["']([^"']+)["']/
    );

    const linkIssues: string[] = [];

    if (mass <= 0) {
      linkIssues.push(`Link "${linkName}" has zero or negative mass (${mass})`);
    } else {
      totalMass += mass;
    }

    let tensor: InertiaTensor;
    if (inertiaMatch) {
      tensor = {
        ixx: parseFloat(inertiaMatch[1]),
        ixy: parseFloat(inertiaMatch[2]),
        ixz: parseFloat(inertiaMatch[3]),
        iyy: parseFloat(inertiaMatch[4]),
        iyz: parseFloat(inertiaMatch[5]),
        izz: parseFloat(inertiaMatch[6]),
      };
    } else {
      linkIssues.push(`Link "${linkName}" missing <inertia> specification`);
      // Suggest box inertia fallback
      tensor = calculateAnalyticalInertia({ type: 'box', x: 0.1, y: 0.1, z: 0.1 }, mass || 1.0);
    }

    const val = validateInertiaTensor(tensor);
    linkIssues.push(...val.issues);

    const isValid = linkIssues.length === 0;
    if (isValid) validLinkCount++;

    linkValidations.push({
      linkName,
      mass: mass || 1.0,
      inertiaValid: val.positiveDefinite && val.triangleInequalityValid,
      positiveDefinite: val.positiveDefinite,
      triangleInequalityValid: val.triangleInequalityValid,
      issues: linkIssues,
      suggestedInertia: isValid ? tensor : calculateAnalyticalInertia({ type: 'box', x: 0.1, y: 0.1, z: 0.1 }, mass || 1.0),
    });
  }

  // 4. Hardware Interface Substitution (<ros2_control>)
  const hardwareAdapter = adaptRos2ControlToSimulation(
    resolvedUrdf,
    options.simulationPluginName || 'upfreq_hardware_interface/UpFreqSimHardware'
  );

  // 5. OpenUSD Generation
  const openUsdContent = generateCanonicalOpenUsd(robotName, resolvedUrdf, linkValidations, options);

  // 6. Calculate Confidence Score
  const massScore = totalMass > 0 ? 30 : 0;
  const linkRatio = totalLinkCount > 0 ? (validLinkCount / totalLinkCount) * 40 : 0;
  const hwScore = hardwareAdapter.substituted ? 30 : 10;
  const confidenceScore = Math.round(massScore + linkRatio + hwScore);

  if (confidenceScore < 70) {
    warnings.push(`Low physics confidence score (${confidenceScore}/100) — simulation override layer generated with corrected inertias.`);
  }

  return {
    success: totalLinkCount > 0,
    confidenceScore,
    robotName,
    openUsdContent,
    simulationOverrideUrdf: hardwareAdapter.modifiedXml,
    linkValidations,
    issues,
    warnings,
    resolvedPackages,
    hardwareInterfaceSubstituted: hardwareAdapter.substituted,
    generatedAt: new Date().toISOString(),
  };
}
