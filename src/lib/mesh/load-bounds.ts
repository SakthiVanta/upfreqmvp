import { computeObject3DBounds } from './segment';
import { load3DModelFromUrl, Supported3DFormat } from './cad-loader';
import { Vec3 } from '../urdf/types';

export interface BoundsSource {
  url: string;
  extension: Supported3DFormat | string;
  scale?: number;
}

/**
 * Loads a link's CAD model or mesh and measures its real-world (scale-corrected)
 * bounding box — supporting STEP, STP, IGES, IGS, BREP, STL, OBJ, glTF, GLB,
 * DAE, 3MF, PLY, and FBX. Shared by AI Generate (component sizing) and the
 * box-approximation inertia estimator, so both reason from real geometry
 * rather than guessed numbers.
 */
export async function loadBoundsMeters(info: BoundsSource): Promise<{ center: Vec3; size: Vec3 }> {
  const scale = info.scale ?? 1;
  const object = await load3DModelFromUrl(info.url, info.extension);
  const bounds = computeObject3DBounds(object);

  return {
    center: { x: bounds.center.x * scale, y: bounds.center.y * scale, z: bounds.center.z * scale },
    size: { x: bounds.size.x * scale, y: bounds.size.y * scale, z: bounds.size.z * scale },
  };
}
