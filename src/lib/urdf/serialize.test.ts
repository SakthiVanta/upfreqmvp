import { describe, it, expect } from 'vitest';
import { validateDesign, validateDesignDetailed, buildUrdfXml } from './serialize';
import { RobotDesignDoc, RobotLink, RobotJoint, zeroOrigin } from './types';

function link(id: string, name: string, extra: Partial<RobotLink> = {}): RobotLink {
  return { id, name, meshUrl: `https://example.com/${name}.stl`, visualOrigin: zeroOrigin(), ...extra };
}

function joint(id: string, name: string, parentLinkId: string, childLinkId: string, extra: Partial<RobotJoint> = {}): RobotJoint {
  return { id, name, type: 'fixed', parentLinkId, childLinkId, origin: zeroOrigin(), ...extra };
}

function doc(links: RobotLink[], joints: RobotJoint[] = []): RobotDesignDoc {
  return { id: 'd1', name: 'test_robot', links, joints };
}

describe('validateDesign', () => {
  it('requires at least one link', () => {
    expect(validateDesign(doc([]))).toEqual(['Add at least one link before exporting.']);
  });

  it('accepts a single link with no joints', () => {
    expect(validateDesign(doc([link('l1', 'base')]))).toEqual([]);
  });

  it('flags duplicate link names', () => {
    const errors = validateDesign(doc([link('l1', 'base'), link('l2', 'base')]));
    expect(errors.some((e) => e.includes('used 2 times'))).toBe(true);
  });

  it('flags duplicate joint names', () => {
    const links = [link('l1', 'base'), link('l2', 'wheel'), link('l3', 'arm')];
    const joints = [
      joint('j1', 'dup', 'l1', 'l2'),
      joint('j2', 'dup', 'l1', 'l3'),
    ];
    const errors = validateDesign(doc(links, joints));
    expect(errors.some((e) => e.includes('Joint name "dup"'))).toBe(true);
  });

  it('flags a joint referencing a missing link', () => {
    const errors = validateDesign(doc([link('l1', 'base')], [joint('j1', 'j', 'l1', 'ghost')]));
    expect(errors.some((e) => e.includes('child link that no longer exists'))).toBe(true);
  });

  it('flags a self-referencing joint', () => {
    const errors = validateDesign(doc([link('l1', 'base'), link('l2', 'wheel')], [joint('j1', 'j', 'l1', 'l1')]));
    expect(errors.some((e) => e.includes('cannot connect a link to itself'))).toBe(true);
  });

  it('requires an axis for movable joint types', () => {
    const links = [link('l1', 'base'), link('l2', 'wheel')];
    const errors = validateDesign(doc(links, [joint('j1', 'j', 'l1', 'l2', { type: 'revolute' })]));
    expect(errors.some((e) => e.includes('requires an axis'))).toBe(true);
  });

  it('requires limits for revolute/prismatic joints', () => {
    const links = [link('l1', 'base'), link('l2', 'wheel')];
    const errors = validateDesign(doc(links, [joint('j1', 'j', 'l1', 'l2', { type: 'prismatic', axis: { x: 0, y: 0, z: 1 } })]));
    expect(errors.some((e) => e.includes('requires lower/upper limits'))).toBe(true);
  });

  it('does not require limits for fixed/continuous joints', () => {
    const links = [link('l1', 'base'), link('l2', 'wheel')];
    const errors = validateDesign(doc(links, [joint('j1', 'j', 'l1', 'l2', { type: 'continuous', axis: { x: 0, y: 1, z: 0 } })]));
    expect(errors).toEqual([]);
  });

  it('flags a link with two parent joints', () => {
    const links = [link('l1', 'a'), link('l2', 'b'), link('l3', 'c')];
    const joints = [joint('j1', 'j1', 'l1', 'l3'), joint('j2', 'j2', 'l2', 'l3')];
    const errors = validateDesign(doc(links, joints));
    expect(errors.some((e) => e.includes('child of 2 joints'))).toBe(true);
  });

  it('flags a cycle as having no root link', () => {
    const links = [link('l1', 'a'), link('l2', 'b')];
    const joints = [joint('j1', 'j1', 'l1', 'l2'), joint('j2', 'j2', 'l2', 'l1')];
    const errors = validateDesign(doc(links, joints));
    expect(errors.some((e) => e.includes('form a cycle'))).toBe(true);
  });

  it('flags disconnected components as multiple roots', () => {
    const links = [link('l1', 'a'), link('l2', 'b'), link('l3', 'c'), link('l4', 'd')];
    const joints = [joint('j1', 'j1', 'l1', 'l2')];
    const errors = validateDesign(doc(links, joints));
    expect(errors.some((e) => e.includes('disconnected root links'))).toBe(true);
  });

  it('accepts a valid connected tree', () => {
    const links = [link('l1', 'base'), link('l2', 'wheel_l'), link('l3', 'wheel_r')];
    const joints = [
      joint('j1', 'base_to_wheel_l', 'l1', 'l2', { type: 'continuous', axis: { x: 0, y: 1, z: 0 } }),
      joint('j2', 'base_to_wheel_r', 'l1', 'l3', { type: 'continuous', axis: { x: 0, y: 1, z: 0 } }),
    ];
    expect(validateDesign(doc(links, joints))).toEqual([]);
  });
});

describe('validateDesignDetailed', () => {
  it('tags issues with the offending link/joint id', () => {
    const links = [link('l1', 'base'), link('l2', 'wheel')];
    const issues = validateDesignDetailed(doc(links, [joint('j1', 'j', 'l1', 'l1')]));
    expect(issues.some((i) => i.jointId === 'j1')).toBe(true);
  });
});

describe('buildUrdfXml', () => {
  const validDesign = doc(
    [link('l1', 'base_link'), link('l2', 'wheel_left')],
    [joint('j1', 'base_to_wheel', 'l1', 'l2', { type: 'continuous', axis: { x: 0, y: 1, z: 0 } })]
  );

  it('throws when the design is invalid', () => {
    expect(() => buildUrdfXml(doc([]))).toThrow(/Cannot export URDF/);
  });

  it('produces well-formed XML with a robot root element', () => {
    const xml = buildUrdfXml(validDesign);
    expect(xml.startsWith('<?xml version="1.0"?>')).toBe(true);
    expect(xml).toContain('<robot name="test_robot">');
    expect(xml).toContain('</robot>');
  });

  it('emits a link block per link with the mesh filename', () => {
    const xml = buildUrdfXml(validDesign);
    expect(xml).toContain('<link name="base_link">');
    expect(xml).toContain('<mesh filename="https://example.com/base_link.stl"/>');
    expect(xml).toContain('<link name="wheel_left">');
  });

  it('emits a joint block with correct parent/child/axis', () => {
    const xml = buildUrdfXml(validDesign);
    expect(xml).toContain('<joint name="base_to_wheel" type="continuous">');
    expect(xml).toContain('<parent link="base_link"/>');
    expect(xml).toContain('<child link="wheel_left"/>');
    expect(xml).toContain('<axis xyz="0 1 0"/>');
  });

  it('emits joint origin xyz/rpy from the joint definition', () => {
    const withOrigin = doc(
      [link('l1', 'base_link'), link('l2', 'wheel_left')],
      [joint('j1', 'j', 'l1', 'l2', { type: 'continuous', axis: { x: 0, y: 1, z: 0 }, origin: { xyz: { x: 0.2, y: 0.15, z: 0 }, rpy: { x: 0, y: 0, z: 0 } } })]
    );
    const xml = buildUrdfXml(withOrigin);
    expect(xml).toContain('<origin xyz="0.2 0.15 0" rpy="0 0 0"/>');
  });

  it('escapes XML-unsafe characters in names', () => {
    const withUnsafeName = doc([link('l1', 'base & <link>')]);
    const xml = buildUrdfXml(withUnsafeName);
    expect(xml).toContain('base &amp; &lt;link&gt;');
    expect(xml).not.toContain('base & <link>');
  });

  it('omits the inertial block when mass/inertia are not set', () => {
    const xml = buildUrdfXml(validDesign);
    expect(xml).not.toContain('<inertial>');
  });

  it('includes the inertial block when mass and inertia are both set', () => {
    const withPhysical = doc([
      link('l1', 'base_link', { mass: 1.5, inertia: { ixx: 0.01, iyy: 0.02, izz: 0.03 } }),
    ]);
    const xml = buildUrdfXml(withPhysical);
    expect(xml).toContain('<inertial>');
    expect(xml).toContain('<mass value="1.5"/>');
    expect(xml).toContain('ixx="0.01"');
  });

  it('defaults limit effort/velocity when only lower/upper are set', () => {
    const links = [link('l1', 'base'), link('l2', 'arm')];
    const withLimit = doc(links, [
      joint('j1', 'shoulder', 'l1', 'l2', { type: 'revolute', axis: { x: 1, y: 0, z: 0 }, limit: { lower: -1.5, upper: 1.5 } }),
    ]);
    const xml = buildUrdfXml(withLimit);
    expect(xml).toContain('<limit lower="-1.5" upper="1.5" effort="10" velocity="1"/>');
  });
});
