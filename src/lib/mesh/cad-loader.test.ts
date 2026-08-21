import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  isSupported3DFormat,
  isCadSolidFormat,
  getFormatInfo,
  SUPPORTED_3D_EXTENSIONS,
  CAD_SOLID_EXTENSIONS,
  inspectModelParts,
} from './cad-loader';

describe('CAD and 3D Format Validation', () => {
  it('recognizes all supported CAD and mesh extensions', () => {
    const expected = ['stl', 'step', 'stp', 'iges', 'igs', 'brep', 'obj', 'dae', 'gltf', 'glb', 'ply', '3mf', 'fbx'];
    expect(SUPPORTED_3D_EXTENSIONS).toEqual(expected);

    for (const ext of expected) {
      expect(isSupported3DFormat(ext)).toBe(true);
      expect(isSupported3DFormat(ext.toUpperCase())).toBe(true);
      expect(isSupported3DFormat(`.${ext}`)).toBe(true);
    }
  });

  it('rejects unsupported extensions', () => {
    expect(isSupported3DFormat('exe')).toBe(false);
    expect(isSupported3DFormat('pdf')).toBe(false);
    expect(isSupported3DFormat('dwg')).toBe(false);
    expect(isSupported3DFormat('zip')).toBe(false);
  });

  it('distinguishes CAD solid formats from standard polygon meshes', () => {
    const cadFormats = ['step', 'stp', 'iges', 'igs', 'brep'];
    expect(CAD_SOLID_EXTENSIONS).toEqual(cadFormats);

    for (const ext of cadFormats) {
      expect(isCadSolidFormat(ext)).toBe(true);
    }

    const meshFormats = ['stl', 'obj', 'gltf', 'glb', 'dae', '3mf', 'ply', 'fbx'];
    for (const ext of meshFormats) {
      expect(isCadSolidFormat(ext)).toBe(false);
    }
  });

  it('returns rich format metadata for CAD and robotics formats', () => {
    const stepInfo = getFormatInfo('step');
    expect(stepInfo.label).toBe('STEP');
    expect(stepInfo.category).toBe('cad_solid');
    expect(stepInfo.hasAssemblyHierarchy).toBe(true);
    expect(stepInfo.industrySoftware).toContain('SolidWorks');

    const stlInfo = getFormatInfo('stl');
    expect(stlInfo.label).toBe('STL');
    expect(stlInfo.category).toBe('mesh');
    expect(stlInfo.industrySoftware).toContain('ROS URDF');

    const daeInfo = getFormatInfo('dae');
    expect(daeInfo.label).toBe('DAE');
    expect(daeInfo.hasAssemblyHierarchy).toBe(true);
    expect(daeInfo.industrySoftware).toContain('ROS Gazebo');

    const threeMfInfo = getFormatInfo('3mf');
    expect(threeMfInfo.label).toBe('3MF');
    expect(threeMfInfo.hasAssemblyHierarchy).toBe(true);
  });
});

describe('inspectModelParts', () => {
  it('accurately extracts hierarchy, triangle count, and dimensions from a 3D assembly', () => {
    const group = new THREE.Group();
    group.name = 'robot_assembly';

    // Link 1: Base box
    const baseGeom = new THREE.BoxGeometry(0.5, 0.2, 0.3);
    const baseMesh = new THREE.Mesh(baseGeom);
    baseMesh.name = 'base_link';
    group.add(baseMesh);

    // Link 2: Wheel cylinder
    const wheelGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
    const wheelMesh = new THREE.Mesh(wheelGeom);
    wheelMesh.name = 'wheel_left';
    wheelMesh.position.set(0.2, 0, 0.15);
    group.add(wheelMesh);

    const inspection = inspectModelParts(group);

    expect(inspection.meshCount).toBe(2);
    expect(inspection.parts.length).toBe(2);
    expect(inspection.parts.map((p) => p.name)).toEqual(['base_link', 'wheel_left']);
    expect(inspection.totalTriangles).toBeGreaterThan(0);
    expect(inspection.size.x).toBeGreaterThan(0);
    expect(inspection.size.y).toBeGreaterThan(0);
    expect(inspection.size.z).toBeGreaterThan(0);
  });
});
