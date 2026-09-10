import { InertiaTensor } from '@/lib/compiler/types';

export interface Vec3 { x: number; y: number; z: number }

export interface MeshMassProperties {
  volumeM3: number;
  boundingBox: { min: Vec3; max: Vec3; size: Vec3 };
  centerOfMass: Vec3;
  massKg: number;
  /** Inertia tensor about the center of mass, for the given massKg, assuming uniform density. */
  inertia: InertiaTensor;
}

/** Extracts (x,y,z) vertex triples from ASCII STL `vertex` lines. */
function parseStlTriangles(stl: string): [Vec3, Vec3, Vec3][] {
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const verts: Vec3[] = [];
  let m: RegExpExecArray | null;
  while ((m = vertexRe.exec(stl)) !== null) {
    verts.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
  }
  if (verts.length % 3 !== 0) {
    throw new Error(`Malformed STL: ${verts.length} vertices is not a multiple of 3.`);
  }
  const triangles: [Vec3, Vec3, Vec3][] = [];
  for (let i = 0; i < verts.length; i += 3) {
    triangles.push([verts[i], verts[i + 1], verts[i + 2]]);
  }
  return triangles;
}

// Computes real volume, center of mass, and inertia tensor for a closed,
// consistently-oriented (outward-normal) triangle mesh, by decomposing it
// into signed tetrahedra (origin, P1, P2, P3) per triangle and summing each
// tetrahedron's exact contribution — derived from the Dirichlet integral
// over the standard simplex (∫∫∫ u^a v^b w^c = a!b!c!/(a+b+c+3)! ), not
// copied from an unverified formula. Assumes uniform density; massKg scales
// the unit-density integrals linearly, which is exact for uniform density.
//
// This is verified against calculateAnalyticalInertia's closed-form box
// formula in mesh-mass-properties.test.ts — the two must agree within
// floating-point tolerance for a box, or this function is wrong.
export function computeMeshMassProperties(stl: string, massKg: number): MeshMassProperties {
  const triangles = parseStlTriangles(stl);
  if (triangles.length === 0) {
    throw new Error('STL contains no triangles — nothing to compute mass properties for.');
  }

  let min: Vec3 = { x: Infinity, y: Infinity, z: Infinity };
  let max: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };

  let volumeSum = 0;
  let cxSum = 0, cySum = 0, czSum = 0;
  // Second moments and products of inertia about the origin, unit density.
  let ixxO = 0, iyyO = 0, izzO = 0;
  let pxyO = 0, pxzO = 0, pyzO = 0;

  const f = (a: number, b: number, c: number) => a * a + b * b + c * c + a * b + a * c + b * c;
  const g = (a1: number, a2: number, a3: number, b1: number, b2: number, b3: number) =>
    (a1 * b1 + a2 * b2 + a3 * b3) / 10 + ((a1 * b2 + a2 * b1) + (a1 * b3 + a3 * b1) + (a2 * b3 + a3 * b2)) / 20;

  for (const [p1, p2, p3] of triangles) {
    for (const p of [p1, p2, p3]) {
      min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y), z: Math.min(min.z, p.z) };
      max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y), z: Math.max(max.z, p.z) };
    }

    // Signed volume of tetrahedron (origin, p1, p2, p3) = p1 . (p2 x p3) / 6
    const cross = {
      x: p2.y * p3.z - p2.z * p3.y,
      y: p2.z * p3.x - p2.x * p3.z,
      z: p2.x * p3.y - p2.y * p3.x,
    };
    const v6 = p1.x * cross.x + p1.y * cross.y + p1.z * cross.z;
    const tetVolume = v6 / 6;

    volumeSum += tetVolume;
    cxSum += tetVolume * (p1.x + p2.x + p3.x) / 4;
    cySum += tetVolume * (p1.y + p2.y + p3.y) / 4;
    czSum += tetVolume * (p1.z + p2.z + p3.z) / 4;

    const fx = (tetVolume / 10) * f(p1.x, p2.x, p3.x);
    const fy = (tetVolume / 10) * f(p1.y, p2.y, p3.y);
    const fz = (tetVolume / 10) * f(p1.z, p2.z, p3.z);
    ixxO += fy + fz;
    iyyO += fx + fz;
    izzO += fx + fy;

    pxyO += tetVolume * g(p1.x, p2.x, p3.x, p1.y, p2.y, p3.y);
    pxzO += tetVolume * g(p1.x, p2.x, p3.x, p1.z, p2.z, p3.z);
    pyzO += tetVolume * g(p1.y, p2.y, p3.y, p1.z, p2.z, p3.z);
  }

  const volume = Math.abs(volumeSum);
  if (volume < 1e-12) {
    throw new Error('Computed mesh volume is ~0 — the mesh may not be closed/manifold, or triangle winding is inconsistent.');
  }

  const com: Vec3 = { x: cxSum / volumeSum, y: cySum / volumeSum, z: czSum / volumeSum };

  // Shift the unit-density inertia tensor from the origin to the center of
  // mass — the exact inverse of applyParallelAxisTheorem's origin-outward
  // shift (src/lib/compiler/preflight-compiler.ts), since here we're going
  // the other direction (origin -> COM, not COM -> offset point).
  const d2 = com.x * com.x + com.y * com.y + com.z * com.z;
  const ixxCm = ixxO - volumeSum * (d2 - com.x * com.x);
  const iyyCm = iyyO - volumeSum * (d2 - com.y * com.y);
  const izzCm = izzO - volumeSum * (d2 - com.z * com.z);
  const ixyCm = -pxyO + volumeSum * (com.x * com.y);
  const ixzCm = -pxzO + volumeSum * (com.x * com.z);
  const iyzCm = -pyzO + volumeSum * (com.y * com.z);

  // Inertia integrals are linear in density for a uniform-density solid —
  // scale the unit-density (volumeSum) tensor to the real requested mass.
  const scale = massKg / volume;

  return {
    volumeM3: volume,
    boundingBox: { min, max, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } },
    centerOfMass: com,
    massKg,
    inertia: {
      ixx: Math.abs(ixxCm * scale),
      iyy: Math.abs(iyyCm * scale),
      izz: Math.abs(izzCm * scale),
      ixy: ixyCm * scale,
      ixz: ixzCm * scale,
      iyz: iyzCm * scale,
    },
  };
}
