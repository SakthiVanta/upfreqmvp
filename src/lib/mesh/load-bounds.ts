import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { computeBounds, computeObject3DBounds } from './segment';
import { Vec3 } from '../urdf/types';

export interface BoundsSource {
  url: string;
  extension: 'stl' | 'obj' | 'glb' | 'gltf';
  scale?: number;
}

/**
 * Loads a link's mesh and measures its real-world (scale-corrected)
 * bounding box — shared by AI Generate (component sizing) and the
 * box-approximation inertia estimator, so both reason from the same real
 * geometry rather than guessed numbers.
 */
export async function loadBoundsMeters(info: BoundsSource): Promise<{ center: Vec3; size: Vec3 }> {
  const scale = info.scale ?? 1;
  let bounds: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };

  if (info.extension === 'stl') {
    const geometry = await new STLLoader().loadAsync(info.url);
    bounds = computeBounds(geometry);
  } else if (info.extension === 'obj') {
    const group = await new OBJLoader().loadAsync(info.url);
    bounds = computeObject3DBounds(group);
  } else {
    const gltf = await new GLTFLoader().loadAsync(info.url);
    bounds = computeObject3DBounds(gltf.scene);
  }

  return {
    center: { x: bounds.center.x * scale, y: bounds.center.y * scale, z: bounds.center.z * scale },
    size: { x: bounds.size.x * scale, y: bounds.size.y * scale, z: bounds.size.z * scale },
  };
}
