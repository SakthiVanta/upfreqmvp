import { describe, it, expect } from 'vitest';
import {
  calculateAnalyticalInertia,
  applyParallelAxisTheorem,
  validateInertiaTensor,
  compilePreflight,
} from './preflight-compiler';
import { replaceHardwareInterfaceWithSim } from './ros2-control-adapter';

describe('Preflight Compiler & OpenUSD Pipeline', () => {
  it('calculates analytical inertia for box primitive', () => {
    // Box: m = 12kg, x = 0.5m, y = 0.4m, z = 0.2m
    const inertia = calculateAnalyticalInertia({ type: 'box', x: 0.5, y: 0.4, z: 0.2 }, 12);
    expect(inertia.ixx).toBeCloseTo((1 / 12) * 12 * (0.4 ** 2 + 0.2 ** 2));
    expect(inertia.iyy).toBeCloseTo((1 / 12) * 12 * (0.5 ** 2 + 0.2 ** 2));
    expect(inertia.izz).toBeCloseTo((1 / 12) * 12 * (0.5 ** 2 + 0.4 ** 2));
  });

  it('applies Parallel Axis Theorem for offset center of mass', () => {
    const baseInertia = { ixx: 0.1, ixy: 0, ixz: 0, iyy: 0.1, iyz: 0, izz: 0.1 };
    const shifted = applyParallelAxisTheorem(baseInertia, 10, { x: 0.1, y: 0, z: 0 });
    // I_yy_shifted = I_yy + m * (x^2 + z^2) = 0.1 + 10 * 0.01 = 0.2
    expect(shifted.iyy).toBeCloseTo(0.2);
    expect(shifted.izz).toBeCloseTo(0.2);
    expect(shifted.ixx).toBeCloseTo(0.1);
  });

  it('validates inertia tensor positive definiteness & triangle inequality', () => {
    const validInertia = { ixx: 0.5, ixy: 0, ixz: 0, iyy: 0.5, iyz: 0, izz: 0.8 };
    const checkValid = validateInertiaTensor(validInertia);
    expect(checkValid.positiveDefinite).toBe(true);
    expect(checkValid.triangleInequalityValid).toBe(true);

    const invalidTriangle = { ixx: 0.1, ixy: 0, ixz: 0, iyy: 0.1, iyz: 0, izz: 0.5 };
    const checkInvalid = validateInertiaTensor(invalidTriangle);
    expect(checkInvalid.triangleInequalityValid).toBe(false);
  });

  it('compiles URDF to OpenUSD and swaps ros2_control hardware interface', () => {
    const sampleUrdf = `<?xml version="1.0"?>
<robot name="test_bot">
  <link name="base_link">
    <inertial>
      <mass value="10.0"/>
      <inertia ixx="0.2" ixy="0" ixz="0" iyy="0.2" iyz="0" izz="0.3"/>
    </inertial>
  </link>
  <ros2_control name="RealHardwareBus" type="system">
    <hardware>
      <plugin>canopen_hardware/CanOpenSystem</plugin>
    </hardware>
  </ros2_control>
</robot>`;

    const compiled = compilePreflight(sampleUrdf, { robotName: 'test_bot' });
    expect(compiled.success).toBe(true);
    expect(compiled.openUsdContent).toContain('metersPerUnit = 1.0');
    expect(compiled.openUsdContent).toContain('upAxis = "Z"');
    expect(compiled.openUsdContent).toContain('PhysicsArticulationRootAPI');
    expect(compiled.hardwareInterfaceSubstituted).toBe(true);
    expect(compiled.simulationOverrideUrdf).toContain('upfreq_hardware_interface/UpFreqSimHardware');
    expect(compiled.confidenceScore).toBeGreaterThanOrEqual(80);
  });
});
