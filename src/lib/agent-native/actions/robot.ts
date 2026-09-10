import { z } from 'zod';
import { AgentNativeAction } from '../types';
import {
  compilePreflight,
  calculateAnalyticalInertia,
  validateInertiaTensor,
  applyParallelAxisTheorem,
} from '@/lib/compiler/preflight-compiler';

export const createDescriptionAction: AgentNativeAction = {
  id: 'upfreq.robot.create_description',
  namespace: 'upfreq.robot',
  name: 'create_description',
  description: 'Synthesizes parametric Xacro & verifies physical inertias from robot specifications or CAD dimensions.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    robotName: z.string().describe('Name of the robot, e.g. "warehouse_amr"'),
    driveType: z.enum(['differential', 'skid_steer', 'ackermann', 'omni', 'quadruped']).default('differential'),
    chassisDimensions: z.object({
      length: z.number().describe('Chassis length in meters'),
      width: z.number().describe('Chassis width in meters'),
      height: z.number().describe('Chassis height in meters'),
      massKg: z.number().describe('Total mass in kg'),
    }),
    wheelParams: z.object({
      radius: z.number().describe('Wheel radius in meters'),
      width: z.number().describe('Wheel track width in meters'),
      wheelbase: z.number().describe('Distance between front/rear axles or left/right wheels'),
    }).optional(),
    sensors: z.array(z.enum(['lidar_2d', 'camera_rgbd', 'imu'])).default(['lidar_2d', 'imu']),
  }),
  async generateProposalDiff(input) {
    return {
      diff: `+ Parametric Xacro: ${input.robotName}.urdf.xacro\n+ Drive: ${input.driveType}\n+ Mass: ${input.chassisDimensions.massKg}kg`,
      rationale: `Synthesize clean REP-103/105 compliant robot description for ${input.robotName}`,
      targetFile: `urdf/${input.robotName}.urdf.xacro`,
    };
  },
  async execute(input) {
    const { robotName, chassisDimensions } = input;
    const chassisInertia = calculateAnalyticalInertia(
      { type: 'box', x: chassisDimensions.length, y: chassisDimensions.width, z: chassisDimensions.height },
      chassisDimensions.massKg
    );

    const xacroXml = `<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="${robotName}">
  <link name="base_footprint"/>
  <joint name="base_joint" type="fixed">
    <parent link="base_footprint"/>
    <child link="base_link"/>
    <origin xyz="0 0 ${chassisDimensions.height / 2}" rpy="0 0 0"/>
  </joint>
  <link name="base_link">
    <visual>
      <geometry>
        <box size="${chassisDimensions.length} ${chassisDimensions.width} ${chassisDimensions.height}"/>
      </geometry>
    </visual>
    <collision>
      <geometry>
        <box size="${chassisDimensions.length} ${chassisDimensions.width} ${chassisDimensions.height}"/>
      </geometry>
    </collision>
    <inertial>
      <mass value="${chassisDimensions.massKg}"/>
      <inertia ixx="${chassisInertia.ixx.toFixed(5)}" ixy="0" ixz="0" iyy="${chassisInertia.iyy.toFixed(5)}" iyz="0" izz="${chassisInertia.izz.toFixed(5)}"/>
    </inertial>
  </link>
</robot>`;

    return {
      robotName,
      xacroXml,
      chassisInertia,
      created: true,
    };
  },
};

export const calculateInertiasAction: AgentNativeAction = {
  id: 'upfreq.robot.calculate_inertias',
  namespace: 'upfreq.robot',
  name: 'calculate_inertias',
  description: 'Calculates analytical and parallel-axis inertia tensors for boxes, cylinders, and meshes.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    geometryType: z.enum(['box', 'cylinder', 'sphere']),
    massKg: z.number().positive(),
    dimensions: z.object({
      x: z.number().optional(),
      y: z.number().optional(),
      z: z.number().optional(),
      radius: z.number().optional(),
      length: z.number().optional(),
    }),
    centerOfMassOffset: z.object({
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(0),
    }).optional(),
  }),
  async execute(input) {
    let baseInertia: any;
    if (input.geometryType === 'box') {
      baseInertia = calculateAnalyticalInertia(
        { type: 'box', x: input.dimensions.x || 0.1, y: input.dimensions.y || 0.1, z: input.dimensions.z || 0.1 },
        input.massKg
      );
    } else if (input.geometryType === 'cylinder') {
      baseInertia = calculateAnalyticalInertia(
        { type: 'cylinder', radius: input.dimensions.radius || 0.05, length: input.dimensions.length || 0.1 },
        input.massKg
      );
    } else {
      baseInertia = calculateAnalyticalInertia(
        { type: 'sphere', radius: input.dimensions.radius || 0.05 },
        input.massKg
      );
    }

    const shiftedInertia = input.centerOfMassOffset
      ? applyParallelAxisTheorem(baseInertia, input.massKg, input.centerOfMassOffset)
      : baseInertia;

    const validation = validateInertiaTensor(shiftedInertia);

    return {
      inertia: shiftedInertia,
      positiveDefinite: validation.positiveDefinite,
      triangleInequalitiesValid: validation.triangleInequalityValid,
      issues: validation.issues,
    };
  },
};

export const validateUrdfAction: AgentNativeAction = {
  id: 'upfreq.robot.validate_urdf',
  namespace: 'upfreq.robot',
  name: 'validate_urdf',
  description: 'Verifies kinematic tree (REP-103/105) and physics validity of a URDF string.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    urdfContent: z.string(),
  }),
  async execute(input) {
    const res = compilePreflight(input.urdfContent);
    return {
      valid: res.success && res.issues.length === 0,
      confidenceScore: res.confidenceScore,
      linkCount: res.linkValidations.length,
      linkValidations: res.linkValidations,
      issues: res.issues,
      warnings: res.warnings,
    };
  },
};

export const compileSimulationAction: AgentNativeAction = {
  id: 'upfreq.robot.compile_simulation',
  namespace: 'upfreq.robot',
  name: 'compile_simulation',
  description: 'Compiles URDF to OpenUSD simulation override layer with ros2_control adapter substitution.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    urdfContent: z.string(),
    robotName: z.string().optional(),
    enableVhacd: z.boolean().default(true),
  }),
  async generateProposalDiff(input) {
    return {
      diff: `+ Generated OpenUSD Stage (.usd)\n+ Simulation Override URDF (<ros2_control> swapped to simulation bus)`,
      rationale: `Compile OpenUSD override layer for ${input.robotName || 'robot'}`,
    };
  },
  async execute(input) {
    const result = compilePreflight(input.urdfContent, {
      robotName: input.robotName,
      enableVhacdDecomposition: input.enableVhacd,
      replaceHardwareInterface: true,
    });
    return result;
  },
};

export const saveRobotAction: AgentNativeAction = {
  id: 'upfreq.robot.save_robot',
  namespace: 'upfreq.robot',
  name: 'save_robot',
  description:
    'Saves a robot to a UpFreq project so it stays up to date across sessions and machines. ' +
    'Call this once you are happy with a robot built via create_description/calculate_inertias/validate_urdf — those are ephemeral and nothing is kept until you call this.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional().describe('Project to save this robot under, if any'),
    name: z.string().describe('Robot name, e.g. "warehouse_amr"'),
    description: z.string().optional(),
    driveType: z.enum(['differential', 'skid_steer', 'ackermann', 'omni', 'quadruped']).optional(),
    chassisDimensions: z.object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      massKg: z.number().optional(),
    }).optional().describe('Used to (re-)compute the inertia tensor stored with the robot'),
    sensors: z.array(z.string()).default([]),
    urdfXacroXml: z.string().optional().describe('The final URDF/Xacro content, e.g. from create_description'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    let chassis: Record<string, unknown> = {};
    if (input.chassisDimensions) {
      const { length, width, height, massKg } = input.chassisDimensions;
      chassis = { length, width, height, massKg };
      if (length != null && width != null && height != null && massKg != null) {
        chassis.inertia = calculateAnalyticalInertia({ type: 'box', x: length, y: width, z: height }, massKg);
      }
    }

    const { saveMcpRobot } = await import('@/lib/db/mcp-robots');
    const robot = await saveMcpRobot(context.userId, {
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      driveType: input.driveType,
      chassis,
      sensors: input.sensors,
      urdfXacroXml: input.urdfXacroXml,
    });

    return {
      success: true,
      robot,
      message: `Robot "${robot.name}" saved${input.projectId ? ' to project' : ''}.`,
    };
  },
};

export const listRobotsAction: AgentNativeAction = {
  id: 'upfreq.robot.list_robots',
  namespace: 'upfreq.robot',
  name: 'list_robots',
  description: 'Lists robots previously saved via save_robot, optionally scoped to one project.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional(),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { count: 0, robots: [] };
    }

    const { listMcpRobots } = await import('@/lib/db/mcp-robots');
    const robots = await listMcpRobots(context.userId, input.projectId);
    return { count: robots.length, robots };
  },
};

const SUPPORTED_MESH_EXTENSIONS = ['stl', 'dae', 'obj', 'fbx', 'usd', 'usda', 'usdc', 'glb', 'gltf'];

export const validateMeshReferenceAction: AgentNativeAction = {
  id: 'upfreq.robot.validate_mesh_reference',
  namespace: 'upfreq.robot',
  name: 'validate_mesh_reference',
  description:
    'Validates a mesh reference (as would go in a URDF <mesh filename="..."/> tag) before wiring it into a robot description — checks the format is one Isaac Sim/ROS 2 actually loads, the filename scheme will resolve on a real ROS 2 machine, scale is non-degenerate, and (if bounding box dimensions are given) flags the classic mm-vs-m unit mismatch from a CAD export. ' +
    'This is pure validation logic, not a mesh parser — it does not open or import the mesh file itself.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    filename: z.string().describe('Mesh filename/path as it would appear in a URDF, e.g. "package://my_robot_description/meshes/base_link.stl"'),
    scale: z.object({ x: z.number(), y: z.number(), z: z.number() }).default({ x: 1, y: 1, z: 1 }),
    boundingBoxMeters: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional()
      .describe('The mesh\'s bounding box in meters, if already known from the CAD export — used to sanity-check units'),
  }),
  async execute(input) {
    const issues: string[] = [];
    const warnings: string[] = [];

    const extMatch = input.filename.toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = extMatch?.[1];
    if (!ext || !SUPPORTED_MESH_EXTENSIONS.includes(ext)) {
      issues.push(`Unsupported or missing mesh format "${ext || '(none)'}" — Isaac Sim/ROS 2 tooling expects one of: ${SUPPORTED_MESH_EXTENSIONS.join(', ')}.`);
    }

    const usesResolvableScheme = /^(package:\/\/|file:\/\/|https?:\/\/|\.\.?\/)/.test(input.filename) || !input.filename.includes(':');
    if (!usesResolvableScheme) {
      warnings.push(`"${input.filename}" doesn't look like a ROS 2-resolvable path (expected package://, file://, or a relative path) — a bare Windows-style absolute path won't resolve on the target machine.`);
    }

    if (input.scale.x <= 0 || input.scale.y <= 0 || input.scale.z <= 0) {
      issues.push(`Non-positive scale (${input.scale.x}, ${input.scale.y}, ${input.scale.z}) — a mesh scale must be positive on every axis.`);
    }

    let likelyUnitMismatch = false;
    if (input.boundingBoxMeters) {
      const { x, y, z } = input.boundingBoxMeters;
      const maxDim = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      if (maxDim > 50) {
        likelyUnitMismatch = true;
        warnings.push(`Bounding box max dimension is ${maxDim}m — implausibly large for a single robot part. This is the classic symptom of importing a mesh authored in millimeters without scaling by 0.001.`);
      } else if (maxDim < 0.001 && maxDim > 0) {
        likelyUnitMismatch = true;
        warnings.push(`Bounding box max dimension is ${maxDim}m — implausibly small. Check whether the mesh was authored in meters as REP-103 requires.`);
      }
    }

    return {
      valid: issues.length === 0,
      format: ext,
      issues,
      warnings,
      likelyUnitMismatch,
    };
  },
};

export const robotActions = [
  createDescriptionAction,
  calculateInertiasAction,
  validateUrdfAction,
  compileSimulationAction,
  validateMeshReferenceAction,
  saveRobotAction,
  listRobotsAction,
];
