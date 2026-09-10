import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { CadNode, generateScadSource } from '@/lib/cad/scad-generator';
import { compileScadToStl } from '@/lib/cad/mesh-compiler';
import { computeMeshMassProperties } from '@/lib/cad/mesh-mass-properties';
import { uploadStlToBlob } from '@/lib/cad/blob-storage';

const CadTransformSchema = z.object({
  translate: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotate: z.tuple([z.number(), z.number(), z.number()]).optional(),
  scale: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

const CadPrimitiveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('box'), size: z.tuple([z.number(), z.number(), z.number()]), center: z.boolean().optional() }),
  z.object({ type: z.literal('cylinder'), radius: z.number(), height: z.number(), center: z.boolean().optional(), segments: z.number().optional() }),
  z.object({ type: z.literal('sphere'), radius: z.number(), segments: z.number().optional() }),
  z.object({ type: z.literal('cone'), radiusBottom: z.number(), radiusTop: z.number(), height: z.number(), center: z.boolean().optional(), segments: z.number().optional() }),
]);

const CadNodeSchema: z.ZodType<CadNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('primitive'), primitive: CadPrimitiveSchema, transform: CadTransformSchema.optional() }),
    z.object({ kind: z.literal('boolean'), op: z.enum(['union', 'difference', 'intersection']), children: z.array(CadNodeSchema), transform: CadTransformSchema.optional() }),
  ])
);

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
const MassPropertiesSchema = z.object({
  volumeM3: z.number(),
  boundingBox: z.object({ min: Vec3Schema, max: Vec3Schema, size: Vec3Schema }),
  centerOfMass: Vec3Schema,
  massKg: z.number(),
  inertia: z.object({ ixx: z.number(), ixy: z.number(), ixz: z.number(), iyy: z.number(), iyz: z.number(), izz: z.number() }),
});

export const generatePartAction: AgentNativeAction = {
  id: 'upfreq.cad.generate_part',
  namespace: 'upfreq.cad',
  name: 'generate_part',
  description:
    'Generates real OpenSCAD source from a structured primitive/boolean-operation tree (box, cylinder, sphere, cone; union, difference, intersection) — fast, deterministic text generation, no mesh compilation yet. ' +
    'Use compile_part next to get real geometry (STL) and mass properties from it.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({ node: CadNodeSchema }),
  async execute(input) {
    return { scadSource: generateScadSource(input.node) };
  },
};

export const compilePartAction: AgentNativeAction = {
  id: 'upfreq.cad.compile_part',
  namespace: 'upfreq.cad',
  name: 'compile_part',
  description:
    'Compiles a structured CAD tree to a real mesh — actual OpenSCAD WebAssembly compilation, not an estimate — and computes real mass properties (volume, center of mass, inertia tensor) for a given mass, assuming uniform density. ' +
    'Returns a downloadable STL URL. This is a real compile (up to ~20s for complex parts), not instant like generate_part.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    node: CadNodeSchema,
    massKg: z.number().positive().default(1.0).describe('Assumed uniform-density mass in kg, used to scale the computed inertia tensor'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    const scadSource = generateScadSource(input.node);
    const stl = await compileScadToStl(scadSource);
    const massProperties = computeMeshMassProperties(stl, input.massKg);

    const tempId = `cad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const stlUrl = await uploadStlToBlob(context.userId, tempId, stl);

    return { success: true, scadSource, stlUrl, massProperties };
  },
};

export const savePartAction: AgentNativeAction = {
  id: 'upfreq.cad.save_part',
  namespace: 'upfreq.cad',
  name: 'save_part',
  description:
    'Saves a CAD part to a UpFreq project so it stays available across sessions and machines. ' +
    'Call this once you are happy with a part built via generate_part/compile_part — those are ephemeral and nothing is kept until you call this.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    node: CadNodeSchema,
    scadSource: z.string(),
    stlUrl: z.string().optional(),
    massProperties: MassPropertiesSchema.optional(),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    const { saveCadPart } = await import('@/lib/db/cad-parts');
    const part = await saveCadPart(context.userId, {
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      nodeTree: input.node,
      scadSource: input.scadSource,
      stlUrl: input.stlUrl,
      massProperties: input.massProperties,
    });

    return { success: true, part, message: `CAD part "${part.name}" saved${input.projectId ? ' to project' : ''}.` };
  },
};

export const listPartsAction: AgentNativeAction = {
  id: 'upfreq.cad.list_parts',
  namespace: 'upfreq.cad',
  name: 'list_parts',
  description: 'Lists CAD parts previously saved via save_part, optionally scoped to one project.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional(),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { count: 0, parts: [] };
    }

    const { listCadParts } = await import('@/lib/db/cad-parts');
    const parts = await listCadParts(context.userId, input.projectId);
    return { count: parts.length, parts };
  },
};

export const attachToRobotAction: AgentNativeAction = {
  id: 'upfreq.cad.attach_to_robot',
  namespace: 'upfreq.cad',
  name: 'attach_to_robot',
  description:
    'Adds a saved, compiled CAD part as a new <link> (referencing its real STL mesh, with real inertial properties from the compiled geometry) into an existing saved robot\'s URDF/Xacro, connected via a fixed joint to a parent link. ' +
    'This is the concrete "use this CAD part on your robot" step — the part must already be compiled (compile_part) and saved (save_part) first.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    robotId: z.string(),
    cadPartId: z.string(),
    linkName: z.string().describe('Name for the new URDF link, e.g. "sensor_mount"'),
    parentLink: z.string().default('base_link'),
    originXyz: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
    originRpy: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  }),
  async generateProposalDiff(input) {
    return {
      diff: `+ Link "${input.linkName}" (mesh from CAD part ${input.cadPartId})\n+ Fixed joint: ${input.parentLink} -> ${input.linkName}`,
      rationale: `Attach saved CAD part to robot ${input.robotId}`,
    };
  },
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    const { getCadPart } = await import('@/lib/db/cad-parts');
    const { getMcpRobot, updateMcpRobot } = await import('@/lib/db/mcp-robots');

    const part = await getCadPart(context.userId, input.cadPartId);
    if (!part) return { success: false, message: 'CAD part not found.' };
    if (!part.stlUrl) return { success: false, message: 'This CAD part has not been compiled yet — call compile_part (and save_part) first.' };

    const robot = await getMcpRobot(context.userId, input.robotId);
    if (!robot) return { success: false, message: 'Robot not found.' };
    if (!robot.urdfXacroXml || !robot.urdfXacroXml.includes('</robot>')) {
      return { success: false, message: 'Robot has no valid URDF/Xacro (missing </robot> tag) to attach to.' };
    }

    const mp = part.massProperties;
    const inertialBlock = mp
      ? `
    <inertial>
      <mass value="${mp.massKg}"/>
      <origin xyz="${mp.centerOfMass.x.toFixed(6)} ${mp.centerOfMass.y.toFixed(6)} ${mp.centerOfMass.z.toFixed(6)}" rpy="0 0 0"/>
      <inertia ixx="${mp.inertia.ixx.toFixed(6)}" ixy="${mp.inertia.ixy.toFixed(6)}" ixz="${mp.inertia.ixz.toFixed(6)}" iyy="${mp.inertia.iyy.toFixed(6)}" iyz="${mp.inertia.iyz.toFixed(6)}" izz="${mp.inertia.izz.toFixed(6)}"/>
    </inertial>`
      : '';

    const linkAndJointXml = `
  <link name="${input.linkName}">
    <visual>
      <geometry><mesh filename="${part.stlUrl}" scale="1 1 1"/></geometry>
    </visual>
    <collision>
      <geometry><mesh filename="${part.stlUrl}" scale="1 1 1"/></geometry>
    </collision>${inertialBlock}
  </link>
  <joint name="${input.parentLink}_to_${input.linkName}" type="fixed">
    <parent link="${input.parentLink}"/>
    <child link="${input.linkName}"/>
    <origin xyz="${input.originXyz.join(' ')}" rpy="${input.originRpy.join(' ')}"/>
  </joint>
`;

    const updatedXml = robot.urdfXacroXml.replace('</robot>', `${linkAndJointXml}</robot>`);
    const updated = await updateMcpRobot(context.userId, input.robotId, updatedXml);

    return { success: true, robot: updated, addedLink: input.linkName, message: `Attached CAD part "${part.name}" as link "${input.linkName}" on robot "${robot.name}".` };
  },
};

export const cadActions = [
  generatePartAction,
  compilePartAction,
  savePartAction,
  listPartsAction,
  attachToRobotAction,
];
