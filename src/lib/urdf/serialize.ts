import { RobotDesignDoc, RobotLink, Origin, jointRequiresAxis, jointRequiresLimit } from './types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtVec3(v: { x: number; y: number; z: number }): string {
  return `${v.x} ${v.y} ${v.z}`;
}

function fmtOrigin(origin: Origin | undefined): string {
  const o = origin ?? { xyz: { x: 0, y: 0, z: 0 }, rpy: { x: 0, y: 0, z: 0 } };
  return `<origin xyz="${fmtVec3(o.xyz)}" rpy="${fmtVec3(o.rpy)}"/>`;
}

export interface ValidationIssue {
  message: string;
  linkId?: string;
  jointId?: string;
}

/**
 * Structured blocking errors, each optionally tagged with the link/joint it
 * applies to so UI panels can show the error inline next to the offending
 * row instead of only in a global list.
 */
export function validateDesignDetailed(design: RobotDesignDoc): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { links, joints } = design;

  if (links.length === 0) {
    issues.push({ message: 'Add at least one link before exporting.' });
    return issues;
  }

  const linkIds = new Set(links.map(l => l.id));
  const linkNameCounts = new Map<string, number>();
  for (const link of links) {
    linkNameCounts.set(link.name, (linkNameCounts.get(link.name) || 0) + 1);
  }
  for (const link of links) {
    const count = linkNameCounts.get(link.name) || 0;
    if (count > 1) issues.push({ message: `Link name "${link.name}" is used ${count} times — link names must be unique.`, linkId: link.id });
  }

  const jointNameCounts = new Map<string, number>();
  for (const joint of joints) {
    jointNameCounts.set(joint.name, (jointNameCounts.get(joint.name) || 0) + 1);
  }

  const childCounts = new Map<string, number>();
  for (const joint of joints) {
    const count = jointNameCounts.get(joint.name) || 0;
    if (count > 1) issues.push({ message: `Joint name "${joint.name}" is used ${count} times — joint names must be unique.`, jointId: joint.id });

    if (!linkIds.has(joint.parentLinkId)) {
      issues.push({ message: `Joint "${joint.name}" references a parent link that no longer exists.`, jointId: joint.id });
    }
    if (!linkIds.has(joint.childLinkId)) {
      issues.push({ message: `Joint "${joint.name}" references a child link that no longer exists.`, jointId: joint.id });
    }
    if (joint.parentLinkId === joint.childLinkId) {
      issues.push({ message: `Joint "${joint.name}" cannot connect a link to itself.`, jointId: joint.id });
    }
    childCounts.set(joint.childLinkId, (childCounts.get(joint.childLinkId) || 0) + 1);

    if (jointRequiresAxis(joint.type) && !joint.axis) {
      issues.push({ message: `Joint "${joint.name}" is type "${joint.type}" and requires an axis.`, jointId: joint.id });
    }
    if (jointRequiresLimit(joint.type) && (!joint.limit || joint.limit.lower === undefined || joint.limit.upper === undefined)) {
      issues.push({ message: `Joint "${joint.name}" is type "${joint.type}" and requires lower/upper limits.`, jointId: joint.id });
    }
  }

  for (const [childId, count] of childCounts) {
    if (count > 1) {
      const link = links.find(l => l.id === childId);
      issues.push({ message: `Link "${link?.name ?? childId}" is the child of ${count} joints — a link can have only one parent joint.`, linkId: childId });
    }
  }

  const roots = links.filter(l => !childCounts.has(l.id));
  if (roots.length === 0) {
    issues.push({ message: 'No root link found — the joints form a cycle.' });
  } else if (roots.length > 1) {
    issues.push({ message: `Found ${roots.length} disconnected root links (${roots.map(r => r.name).join(', ')}) — connect them with joints so the robot forms a single tree.` });
  }

  return issues;
}

/**
 * Human-readable blocking errors. Callers should check this before calling
 * buildUrdfXml — an empty array means the design is exportable.
 */
export function validateDesign(design: RobotDesignDoc): string[] {
  return validateDesignDetailed(design).map(issue => issue.message);
}

export interface BuildUrdfOptions {
  /** Overrides how a link's mesh is referenced — defaults to link.meshUrl
   * (a direct HTTPS URL, only meaningful for in-browser preview). Pass this
   * to emit package://-style paths instead, e.g. when bundling a real ROS
   * package where the mesh file physically exists at that path. */
  meshUri?: (link: RobotLink) => string;
}

function meshTag(link: RobotLink, options?: BuildUrdfOptions): string {
  const uri = options?.meshUri ? options.meshUri(link) : link.meshUrl!;
  const scale = link.meshScale;
  const scaleAttr = scale !== undefined && scale !== 1 ? ` scale="${scale} ${scale} ${scale}"` : '';
  return `<mesh filename="${escapeXml(uri)}"${scaleAttr}/>`;
}

function linkXml(link: RobotLink, options?: BuildUrdfOptions): string {
  const parts: string[] = [`  <link name="${escapeXml(link.name)}">`];

  if (link.meshUrl) {
    parts.push(`    <visual>`);
    parts.push(`      ${fmtOrigin(link.visualOrigin)}`);
    parts.push(`      <geometry>`);
    parts.push(`        ${meshTag(link, options)}`);
    parts.push(`      </geometry>`);
    if (link.color) {
      const [r, g, b, a] = link.color;
      parts.push(`      <material name="${escapeXml(link.name)}_material">`);
      parts.push(`        <color rgba="${r} ${g} ${b} ${a}"/>`);
      parts.push(`      </material>`);
    }
    parts.push(`    </visual>`);

    const collisionOrigin = link.useVisualAsCollision === false ? link.collisionOrigin : (link.collisionOrigin ?? link.visualOrigin);
    parts.push(`    <collision>`);
    parts.push(`      ${fmtOrigin(collisionOrigin)}`);
    parts.push(`      <geometry>`);
    parts.push(`        ${meshTag(link, options)}`);
    parts.push(`      </geometry>`);
    parts.push(`    </collision>`);
  }

  if (link.mass !== undefined && link.inertia) {
    const i = link.inertia;
    parts.push(`    <inertial>`);
    parts.push(`      ${fmtOrigin(link.visualOrigin)}`);
    parts.push(`      <mass value="${link.mass}"/>`);
    parts.push(
      `      <inertia ixx="${i.ixx}" ixy="${i.ixy ?? 0}" ixz="${i.ixz ?? 0}" iyy="${i.iyy}" iyz="${i.iyz ?? 0}" izz="${i.izz}"/>`
    );
    parts.push(`    </inertial>`);
  }

  parts.push(`  </link>`);
  return parts.join('\n');
}

function jointXml(joint: RobotDesignDoc['joints'][number], linksById: Map<string, RobotLink>): string {
  const parent = linksById.get(joint.parentLinkId);
  const child = linksById.get(joint.childLinkId);
  const parts: string[] = [`  <joint name="${escapeXml(joint.name)}" type="${joint.type}">`];
  parts.push(`    <parent link="${escapeXml(parent?.name ?? joint.parentLinkId)}"/>`);
  parts.push(`    <child link="${escapeXml(child?.name ?? joint.childLinkId)}"/>`);
  parts.push(`    ${fmtOrigin(joint.origin)}`);

  if (joint.axis) {
    parts.push(`    <axis xyz="${fmtVec3(joint.axis)}"/>`);
  }

  if (jointRequiresLimit(joint.type) && joint.limit) {
    const l = joint.limit;
    parts.push(
      `    <limit lower="${l.lower}" upper="${l.upper}" effort="${l.effort ?? 10}" velocity="${l.velocity ?? 1}"/>`
    );
  }

  parts.push(`  </joint>`);
  return parts.join('\n');
}

/**
 * Serializes a design to URDF XML. Throws if validateDesign(design) is
 * non-empty — callers driving UI should check validateDesign first so they
 * can disable the export action with a specific reason instead of catching
 * this.
 */
export function buildUrdfXml(design: RobotDesignDoc, options?: BuildUrdfOptions): string {
  const errors = validateDesign(design);
  if (errors.length > 0) {
    throw new Error(`Cannot export URDF: ${errors[0]}`);
  }

  const linksById = new Map(design.links.map(l => [l.id, l]));
  const lines: string[] = [];
  lines.push('<?xml version="1.0"?>');
  lines.push(`<robot name="${escapeXml(design.name)}">`);
  for (const link of design.links) lines.push(linkXml(link, options));
  for (const joint of design.joints) lines.push(jointXml(joint, linksById));
  lines.push('</robot>');
  return lines.join('\n');
}
