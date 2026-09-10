import { describe, it, expect } from 'vitest';
import { computeMeshMassProperties } from './mesh-mass-properties';
import { calculateAnalyticalInertia } from '@/lib/compiler/preflight-compiler';

// Builds an ASCII STL for an axis-aligned box, outward-normal, consistent
// winding — the same shape OpenSCAD would emit for `cube([sx,sy,sz])`.
// Hand-constructed (not WASM-generated) so this test stays fast and has no
// runtime dependency on the OpenSCAD WASM module — the algorithm itself was
// cross-validated against a real WASM-compiled box during development (see
// scripts/_test-mesh-inertia.mjs, run manually, not part of the suite).
function buildBoxStl(sx: number, sy: number, sz: number, center: { x: number; y: number; z: number }): string {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const { x: cx, y: cy, z: cz } = center;
  const v = (dx: number, dy: number, dz: number) => `${cx + dx} ${cy + dy} ${cz + dz}`;

  // 8 corners
  const p = {
    lll: v(-hx, -hy, -hz), lhl: v(-hx, hy, -hz), hhl: v(hx, hy, -hz), hll: v(hx, -hy, -hz),
    llh: v(-hx, -hy, hz), lhh: v(-hx, hy, hz), hhh: v(hx, hy, hz), hlh: v(hx, -hy, hz),
  };

  // 12 triangles, 2 per face, outward-normal consistent winding.
  const faces: [string, string, string][] = [
    // bottom (z-)
    [p.lll, p.hll, p.hhl], [p.lll, p.hhl, p.lhl],
    // top (z+)
    [p.llh, p.hhh, p.hlh], [p.llh, p.lhh, p.hhh],
    // front (y-)
    [p.lll, p.hlh, p.hll], [p.lll, p.llh, p.hlh],
    // back (y+)
    [p.lhl, p.hhl, p.hhh], [p.lhl, p.hhh, p.lhh],
    // left (x-)
    [p.lll, p.lhl, p.lhh], [p.lll, p.lhh, p.llh],
    // right (x+)
    [p.hll, p.hhh, p.hhl], [p.hll, p.hlh, p.hhh],
  ];

  const facetLines = faces.map(([a, b, c]) =>
    `facet normal 0 0 0\nouter loop\nvertex ${a}\nvertex ${b}\nvertex ${c}\nendloop\nendfacet`
  );
  return `solid box\n${facetLines.join('\n')}\nendsolid box`;
}

describe('computeMeshMassProperties', () => {
  it('matches the closed-form box inertia formula exactly for a centered box', () => {
    const massKg = 12.5;
    const stl = buildBoxStl(2, 3, 4, { x: 0, y: 0, z: 0 });
    const mesh = computeMeshMassProperties(stl, massKg);
    const analytical = calculateAnalyticalInertia({ type: 'box', x: 2, y: 3, z: 4 }, massKg);

    expect(mesh.volumeM3).toBeCloseTo(24, 6);
    expect(mesh.centerOfMass.x).toBeCloseTo(0, 6);
    expect(mesh.centerOfMass.y).toBeCloseTo(0, 6);
    expect(mesh.centerOfMass.z).toBeCloseTo(0, 6);
    expect(mesh.inertia.ixx).toBeCloseTo(analytical.ixx, 6);
    expect(mesh.inertia.iyy).toBeCloseTo(analytical.iyy, 6);
    expect(mesh.inertia.izz).toBeCloseTo(analytical.izz, 6);
    expect(mesh.inertia.ixy).toBeCloseTo(0, 6);
    expect(mesh.inertia.ixz).toBeCloseTo(0, 6);
    expect(mesh.inertia.iyz).toBeCloseTo(0, 6);
  });

  it('still matches the box formula (about its own COM) when the box is far from the origin', () => {
    const massKg = 12.5;
    const stl = buildBoxStl(2, 3, 4, { x: 15, y: -7, z: 3 });
    const mesh = computeMeshMassProperties(stl, massKg);
    const analytical = calculateAnalyticalInertia({ type: 'box', x: 2, y: 3, z: 4 }, massKg);

    expect(mesh.centerOfMass.x).toBeCloseTo(15, 6);
    expect(mesh.centerOfMass.y).toBeCloseTo(-7, 6);
    expect(mesh.centerOfMass.z).toBeCloseTo(3, 6);
    expect(mesh.inertia.ixx).toBeCloseTo(analytical.ixx, 6);
    expect(mesh.inertia.iyy).toBeCloseTo(analytical.iyy, 6);
    expect(mesh.inertia.izz).toBeCloseTo(analytical.izz, 6);
  });

  it('scales mass linearly for the same geometry', () => {
    const stl = buildBoxStl(1, 1, 1, { x: 0, y: 0, z: 0 });
    const at1kg = computeMeshMassProperties(stl, 1);
    const at5kg = computeMeshMassProperties(stl, 5);
    expect(at5kg.inertia.ixx).toBeCloseTo(at1kg.inertia.ixx * 5, 6);
  });

  it('throws on a non-manifold / zero-volume input rather than returning silently-wrong physics', () => {
    expect(() => computeMeshMassProperties('solid empty\nendsolid empty', 1)).toThrow();
  });
});
