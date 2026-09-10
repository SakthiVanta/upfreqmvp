/**
 * ROS 2 Control Adapter - replaces hardware bus plugins (CANopen, EtherCAT, serial, etc.)
 * with the UpFreq Simulation Hardware Interface inside the simulation override layer.
 * 
 * Guarantees Software Fidelity Principle: Upfreq executes 100% of the engineer's real
 * ROS 2 controllers (diff_drive_controller, joint_trajectory_controller, Nav2) without
 * injecting shortcut Isaac Sim Action Graphs or bypassing Controller Manager.
 */

export interface HardwareAdapterResult {
  modifiedXml: string;
  substituted: boolean;
  originalPlugin?: string;
  newPlugin: string;
  detectedJoints: string[];
  commandInterfaces: string[];
  stateInterfaces: string[];
}

export const replaceHardwareInterfaceWithSim = adaptRos2ControlToSimulation;

export function adaptRos2ControlToSimulation(
  urdfXml: string,
  simPlugin: string = 'upfreq_hardware_interface/UpFreqSimHardware'
): HardwareAdapterResult {
  const detectedJoints: string[] = [];
  const commandInterfaces: string[] = [];
  const stateInterfaces: string[] = [];

  // Extract joints in ros2_control
  const jointMatches = urdfXml.matchAll(/<joint\s+name=["']([^"']+)["']/g);
  for (const m of jointMatches) {
    if (!detectedJoints.includes(m[1])) {
      detectedJoints.push(m[1]);
    }
  }

  // Extract interfaces
  const cmdMatches = urdfXml.matchAll(/<command_interface\s+name=["']([^"']+)["']/g);
  for (const m of cmdMatches) {
    if (!commandInterfaces.includes(m[1])) {
      commandInterfaces.push(m[1]);
    }
  }

  const stateMatches = urdfXml.matchAll(/<state_interface\s+name=["']([^"']+)["']/g);
  for (const m of stateMatches) {
    if (!stateInterfaces.includes(m[1])) {
      stateInterfaces.push(m[1]);
    }
  }

  // Check if <ros2_control> exists
  const ros2ControlRegex = /<ros2_control\b[^>]*>([\s\S]*?)<\/ros2_control>/;
  const match = urdfXml.match(ros2ControlRegex);

  if (!match) {
    // If no ros2_control exists, synthesize a standard simulation block for the detected joints
    const synthJoints = detectedJoints.length > 0 ? detectedJoints : ['left_wheel_joint', 'right_wheel_joint'];
    const synthBlock = `
  <!-- UpFreq Simulation ros2_control Hardware Interface (Parity Stack) -->
  <ros2_control name="UpFreqSimSystem" type="system">
    <hardware>
      <plugin>${simPlugin}</plugin>
      <param name="sim_time_authority">true</param>
    </hardware>
${synthJoints.map(j => `    <joint name="${j}">
      <command_interface name="velocity">
        <param name="min">-10.0</param>
        <param name="max">10.0</param>
      </command_interface>
      <state_interface name="position"/>
      <state_interface name="velocity"/>
    </joint>`).join('\n')}
  </ros2_control>`;

    const modifiedXml = urdfXml.replace('</robot>', `${synthBlock}\n</robot>`);
    return {
      modifiedXml,
      substituted: true,
      newPlugin: simPlugin,
      detectedJoints: synthJoints,
      commandInterfaces: ['velocity'],
      stateInterfaces: ['position', 'velocity'],
    };
  }

  const controlContent = match[1];
  const hardwareRegex = /<hardware>([\s\S]*?)<\/hardware>/;
  const hardwareMatch = controlContent.match(hardwareRegex);

  let originalPlugin = 'unknown';
  if (hardwareMatch) {
    const pluginMatch = hardwareMatch[1].match(/<plugin>([^<]+)<\/plugin>/);
    if (pluginMatch) {
      originalPlugin = pluginMatch[1].trim();
    }
  }

  // Swap out hardware block plugin with simulation hardware interface plugin
  const newHardwareBlock = `<hardware>
      <plugin>${simPlugin}</plugin>
      <param name="sim_time_authority">true</param>
      <param name="original_hardware_plugin">${originalPlugin}</param>
    </hardware>`;

  let newControlContent = controlContent;
  if (hardwareMatch) {
    newControlContent = controlContent.replace(hardwareRegex, newHardwareBlock);
  } else {
    newControlContent = `\n    ${newHardwareBlock}\n` + controlContent;
  }

  const modifiedXml = urdfXml.replace(ros2ControlRegex, `<ros2_control name="UpFreqSimulationControl" type="system">${newControlContent}</ros2_control>`);

  return {
    modifiedXml,
    substituted: true,
    originalPlugin,
    newPlugin: simPlugin,
    detectedJoints,
    commandInterfaces: commandInterfaces.length > 0 ? commandInterfaces : ['velocity'],
    stateInterfaces: stateInterfaces.length > 0 ? stateInterfaces : ['position', 'velocity'],
  };
}
