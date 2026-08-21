// Framework-free domain types for the Robots module's manual URDF builder.
// No imports outside this file — reused as-is by the DB layer, the client
// wrapper, and the pure serializer in ./serialize.ts.

export type JointType = 'revolute' | 'continuous' | 'prismatic' | 'fixed' | 'floating' | 'planar';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Origin {
  xyz: Vec3;
  rpy: Vec3;
}

export interface RobotLink {
  id: string;
  name: string;
  meshFileId?: string;
  meshUrl?: string;
  /** Uniform scale applied to the mesh, both in the viewer and the exported
   * URDF's <mesh scale="…">. STL has no embedded units — most STL files
   * (this app's own turntable/CAD-export test fixtures included) are
   * authored in millimeters, so 0.001 is the common real-world value here.
   * Undefined/1 means "use the mesh's raw coordinates as meters". */
  meshScale?: number;
  visualOrigin?: Origin;
  collisionOrigin?: Origin;
  useVisualAsCollision?: boolean;
  mass?: number;
  inertia?: {
    ixx: number;
    iyy: number;
    izz: number;
    ixy?: number;
    ixz?: number;
    iyz?: number;
  };
  color?: [number, number, number, number];
}

export interface RobotJoint {
  id: string;
  name: string;
  type: JointType;
  parentLinkId: string;
  childLinkId: string;
  origin: Origin;
  axis?: Vec3;
  limit?: {
    lower?: number;
    upper?: number;
    effort?: number;
    velocity?: number;
  };
}

export interface RobotDesignDoc {
  id: string;
  name: string;
  description?: string;
  links: RobotLink[];
  joints: RobotJoint[];
}

export function zeroVec3(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

export function zeroOrigin(): Origin {
  return { xyz: zeroVec3(), rpy: zeroVec3() };
}

const MOVABLE_JOINT_TYPES: JointType[] = ['revolute', 'continuous', 'prismatic', 'planar'];

export function jointRequiresAxis(type: JointType): boolean {
  return MOVABLE_JOINT_TYPES.includes(type);
}

export function jointRequiresLimit(type: JointType): boolean {
  return type === 'revolute' || type === 'prismatic';
}
