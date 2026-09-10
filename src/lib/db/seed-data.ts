import { getDb } from './client';
import * as schema from '../schema';
import { RobotProfile } from '../robot-profile';

export const ANDINO_SEED_PROFILE: RobotProfile = {
  id: 'andino',
  name: 'Andino Autonomous Base',
  repoUrl: 'https://github.com/Ekumen-OS/andino',
  rosVersion: 'ROS 2 Humble / Iron',
  description:
    'Open-source differential drive mobile robot platform by Ekumen Labs, built for indoor autonomous navigation, education, and robotics research with Nav2 and ROS 2.',
  packages: [
    {
      name: 'andino_description',
      version: '0.1.0',
      description: 'Robot description and 3D kinematic model for Andino',
      buildType: 'ament_cmake',
      dependencies: ['urdf', 'xacro'],
      folderPath: 'andino_description',
    },
    {
      name: 'andino_bringup',
      version: '0.1.0',
      description: 'Launch files and system orchestration for physical Andino robot',
      buildType: 'ament_cmake',
      dependencies: ['rplidar_ros', 'v4l2_camera'],
      folderPath: 'andino_bringup',
    },
    {
      name: 'andino_navigation',
      version: '0.1.0',
      description: 'Nav2 navigation configurations, costmap parameters, and planner configs',
      buildType: 'ament_cmake',
      dependencies: ['nav2_bringup', 'nav2_costmap_2d'],
      folderPath: 'andino_navigation',
    },
  ],
  chassis: {
    length: 0.35,
    width: 0.28,
    height: 0.20,
    wheelbase: 0.22,
    wheelRadius: 0.045,
    totalMassKg: 4.5,
    centerOfGravity: { x: 0.01, y: 0.0, z: 0.06 },
    inertia: { ixx: 0.05, iyy: 0.05, izz: 0.08 },
    maxSpeedLinearMs: 1.2,
    maxSpeedAngularRads: 2.5,
  },
  sensors: [
    {
      id: 'sensor_rplidar_a1',
      name: 'SLAMTEC RPLidar A1M8',
      type: '2D 360° Laser Scanner (LiDAR)',
      linkName: 'rplidar_laser_link',
      parentLink: 'lidar_base_link',
      position: { x: 0.0666, y: 0.0, z: 0.0848 },
      orientation: { r: 0.0, p: 0.0, y: 3.14159 },
      frameId: 'rplidar_laser_link',
      collisionType: 'cylinder',
      mass: 0.17,
      detailedParams: [
        { label: 'Range', value: '0.15 - 12.0', unit: 'm', category: 'performance' },
        { label: 'Sample Rate', value: '8000', unit: 'Hz', category: 'performance' },
        { label: 'Field of View', value: '360', unit: 'deg', category: 'geometry' },
      ],
      meshUrl: 'https://raw.githubusercontent.com/Ekumen-OS/andino/humble/andino_description/meshes/rplidar-a1.stl',
      sourceFile: 'andino_description/urdf/include/common_sensors.urdf.xacro',
    },
    {
      id: 'sensor_camera_v2',
      name: 'Raspberry Pi Camera V2',
      type: 'RGB Monocular Camera',
      linkName: 'camera_link',
      parentLink: 'base_link',
      position: { x: 0.098, y: 0.0, z: 0.025 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: 'camera_link',
      collisionType: 'box',
      mass: 0.08,
      detailedParams: [
        { label: 'Resolution', value: '1080p @ 30fps', unit: '', category: 'imaging' },
        { label: 'Horizontal FOV', value: '62.2', unit: 'deg', category: 'optics' },
      ],
      meshUrl: 'https://raw.githubusercontent.com/Ekumen-OS/andino/humble/andino_description/meshes/camera_mount.stl',
      sourceFile: 'andino_description/urdf/include/common_sensors.urdf.xacro',
    },
  ],
  simulationPlugins: [
    {
      name: 'DiffDrivePlugin',
      targetLink: 'base_link',
      sensorType: 'DifferentialDrive',
      pluginSystem: 'Gazebo / Isaac Sim PhysX',
      rosTopic: '/cmd_vel',
      rosMessageType: 'geometry_msgs/msg/Twist',
    },
    {
      name: 'LaserScanPlugin',
      targetLink: 'rplidar_laser_link',
      sensorType: 'RaycastLiDAR',
      pluginSystem: 'Isaac Sim RTX Lidar',
      updateRateHz: 10,
      rosTopic: '/scan',
      rosMessageType: 'sensor_msgs/msg/LaserScan',
    },
  ],
  topics: [
    { topic: '/scan', type: 'sensor_msgs/msg/LaserScan', direction: 'Publisher', nodeOwner: 'rplidar_node', description: '2D planar laser scan for obstacle detection & mapping' },
    { topic: '/camera/image_raw', type: 'sensor_msgs/msg/Image', direction: 'Publisher', nodeOwner: 'v4l2_camera_node', description: 'Monocular RGB video stream' },
    { topic: '/cmd_vel', type: 'geometry_msgs/msg/Twist', direction: 'Subscriber', nodeOwner: 'diff_drive_controller', description: 'Velocity command inputs' },
    { topic: '/odom', type: 'nav_msgs/msg/Odometry', direction: 'Publisher', nodeOwner: 'diff_drive_controller', description: 'Wheel odometry state estimation' },
  ],
  sensorToModuleMappings: [],
  dataFlowPipeline: { nodes: [], edges: [] },
  autonomyModules: [
    {
      name: 'SLAM',
      status: 'Implemented in Codebase',
      nodeName: 'sync_slam_toolbox_node',
      packageSource: 'slam_toolbox',
      evidence: 'Referenced in andino_navigation/launch/slam.launch.py',
      configFiles: ['andino_navigation/config/slam_toolbox.yaml'],
    },
    {
      name: 'Navigation',
      status: 'Implemented in Codebase',
      nodeName: 'bt_navigator',
      packageSource: 'nav2_bt_navigator',
      evidence: 'Configured in andino_navigation/config/nav2.yaml',
      configFiles: ['andino_navigation/config/nav2.yaml'],
    },
  ],
  robotVariants: ['andino'],
  robotModels: [],
  codebaseReview: [],
  navigationStack: [],
  environments: [],
  externalDependencies: [],
  testCases: [],
  launchFiles: ['andino_bringup/launch/andino_robot.launch.py'],
  yamlConfigFiles: ['andino_description/config/andino/sensors.yaml'],
  diagnosticsNotice: 'Standard seed profile for Ekumen Andino robot.',
};

export const TURTLEBOT4_SEED_PROFILE: RobotProfile = {
  id: 'turtlebot4',
  name: 'ROS 2 TurtleBot 4 (Standard & Lite)',
  repoUrl: 'https://github.com/turtlebot/turtlebot4',
  rosVersion: 'ROS 2 Humble / Jazzy',
  description:
    'The official next-generation open-source robotics platform by Open Robotics and Clearpath Robotics, built on the iRobot Create 3 mobile base with Raspberry Pi 4 and OAK-D spatial AI stereo vision.',
  packages: [
    {
      name: 'turtlebot4_description',
      version: '1.0.3',
      description: 'URDF descriptions, meshes, and kinematic macros for TurtleBot 4 Standard and Lite',
      buildType: 'ament_cmake',
      dependencies: ['irobot_create_description', 'urdf', 'xacro'],
      folderPath: 'turtlebot4_description',
    },
    {
      name: 'turtlebot4_navigation',
      version: '1.0.3',
      description: 'Nav2 configurations, SLAM Toolbox launch files, and depot/warehouse maps',
      buildType: 'ament_cmake',
      dependencies: ['nav2_bringup', 'slam_toolbox'],
      folderPath: 'turtlebot4_navigation',
    },
    {
      name: 'turtlebot4_node',
      version: '1.0.3',
      description: 'TurtleBot 4 main controller node managing HMI screen, buttons, LEDs, and power states',
      buildType: 'ament_cmake',
      dependencies: ['rclcpp', 'sensor_msgs'],
      folderPath: 'turtlebot4_node',
    },
  ],
  chassis: {
    length: 0.34,
    width: 0.34,
    height: 0.35,
    wheelbase: 0.233,
    wheelRadius: 0.036,
    totalMassKg: 3.9,
    centerOfGravity: { x: 0.0, y: 0.0, z: 0.09 },
    inertia: { ixx: 0.038, iyy: 0.038, izz: 0.056 },
    maxSpeedLinearMs: 0.46,
    maxSpeedAngularRads: 1.9,
  },
  sensors: [
    {
      id: 'sensor_rplidar_a1_tb4',
      name: 'RPLIDAR A1 2D Laser Scanner',
      type: '2D 360° Laser Scanner (LiDAR)',
      linkName: 'rplidar_link',
      parentLink: 'oakd_pro_mount_link',
      position: { x: 0.0, y: 0.0, z: 0.28 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: 'rplidar_link',
      collisionType: 'cylinder',
      mass: 0.19,
      detailedParams: [
        { label: 'Range', value: '0.15 - 12.0', unit: 'm', category: 'performance' },
        { label: 'Sample Frequency', value: '5.5 - 10', unit: 'Hz', category: 'performance' },
        { label: 'Laser Wavelength', value: '785', unit: 'nm', category: 'optical' },
      ],
      meshUrl: 'https://raw.githubusercontent.com/turtlebot/turtlebot4/humble/turtlebot4_description/meshes/rplidar.stl',
      sourceFile: 'turtlebot4_description/urdf/sensors/rplidar.urdf.xacro',
    },
    {
      id: 'sensor_oakd_lite',
      name: 'Luxonis OAK-D Lite Spatial AI Camera',
      type: 'Stereo RGB-D Spatial AI Camera',
      linkName: 'oakd_link',
      parentLink: 'base_link',
      position: { x: 0.08, y: 0.0, z: 0.20 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: 'oakd_link',
      collisionType: 'box',
      mass: 0.115,
      detailedParams: [
        { label: 'Depth Range', value: '0.2 - 10.0', unit: 'm', category: 'depth' },
        { label: 'Baseline', value: '7.5', unit: 'cm', category: 'stereo' },
        { label: 'Onboard Neural Engine', value: 'Myriad X (4 TOPS)', unit: '', category: 'ai' },
      ],
      meshUrl: 'https://raw.githubusercontent.com/turtlebot/turtlebot4/humble/turtlebot4_description/meshes/oakd.stl',
      sourceFile: 'turtlebot4_description/urdf/sensors/oakd.urdf.xacro',
    },
    {
      id: 'sensor_imu_tb4',
      name: 'Create 3 Internal 6-Axis IMU',
      type: 'Inertial Measurement Unit (IMU)',
      linkName: 'imu_link',
      parentLink: 'base_link',
      position: { x: 0.0, y: 0.0, z: 0.04 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: 'imu_link',
      collisionType: 'box',
      mass: 0.01,
      detailedParams: [
        { label: 'Update Rate', value: '62', unit: 'Hz', category: 'rate' },
        { label: 'Channels', value: '3-axis Gyro + 3-axis Accel', unit: '', category: 'telemetry' },
      ],
      sourceFile: 'turtlebot4_description/urdf/standard/turtlebot4.urdf.xacro',
    },
    {
      id: 'sensor_cliff_sensors',
      name: 'Create 3 4x Optical Cliff Sensors',
      type: 'Infrared Cliff / Drop Sensor Array',
      linkName: 'cliff_sensor_front_left_link',
      parentLink: 'base_link',
      position: { x: 0.14, y: 0.08, z: 0.01 },
      orientation: { r: 0.0, p: 1.5708, y: 0.0 },
      frameId: 'cliff_sensor_front_left_link',
      collisionType: 'cylinder',
      mass: 0.02,
      detailedParams: [
        { label: 'Sensor Count', value: '4 (Left, Front-Left, Front-Right, Right)', unit: '', category: 'safety' },
        { label: 'Detection Threshold', value: '0.04', unit: 'm', category: 'safety' },
      ],
      sourceFile: 'turtlebot4_description/urdf/standard/turtlebot4.urdf.xacro',
    },
  ],
  simulationPlugins: [
    {
      name: 'Create3DiffDrive',
      targetLink: 'base_link',
      sensorType: 'DifferentialDrive',
      pluginSystem: 'Isaac Sim PhysX / Ignition',
      rosTopic: '/cmd_vel',
      rosMessageType: 'geometry_msgs/msg/Twist',
    },
    {
      name: 'RplidarRaycast',
      targetLink: 'rplidar_link',
      sensorType: 'RaycastLiDAR',
      pluginSystem: 'Isaac Sim RTX Lidar',
      updateRateHz: 10,
      rosTopic: '/scan',
      rosMessageType: 'sensor_msgs/msg/LaserScan',
    },
    {
      name: 'OakdDepthFrustum',
      targetLink: 'oakd_link',
      sensorType: 'StereoDepthFrustum',
      pluginSystem: 'Isaac Sim RTX Camera',
      updateRateHz: 30,
      rosTopic: '/oakd/rgb/preview/image_raw',
      rosMessageType: 'sensor_msgs/msg/Image',
    },
  ],
  topics: [
    { topic: '/scan', type: 'sensor_msgs/msg/LaserScan', direction: 'Publisher', nodeOwner: 'rplidar_node', description: '2D LiDAR planar laser range finding' },
    { topic: '/oakd/rgb/preview/image_raw', type: 'sensor_msgs/msg/Image', direction: 'Publisher', nodeOwner: 'oakd_node', description: 'Color camera visual stream' },
    { topic: '/oakd/stereo/depth', type: 'sensor_msgs/msg/Image', direction: 'Publisher', nodeOwner: 'oakd_node', description: 'Stereo disparity depth map' },
    { topic: '/cmd_vel', type: 'geometry_msgs/msg/Twist', direction: 'Subscriber', nodeOwner: 'turtlebot4_base', description: 'Base motion commands' },
    { topic: '/odom', type: 'nav_msgs/msg/Odometry', direction: 'Publisher', nodeOwner: 'turtlebot4_base', description: 'Create 3 wheel odometry' },
    { topic: '/imu', type: 'sensor_msgs/msg/Imu', direction: 'Publisher', nodeOwner: 'turtlebot4_base', description: '6-axis IMU angular velocity and linear acceleration' },
    { topic: '/hazard_detection', type: 'irobot_create_msgs/msg/HazardDetectionVector', direction: 'Publisher', nodeOwner: 'turtlebot4_base', description: 'Bump and cliff hazard events' },
  ],
  sensorToModuleMappings: [],
  dataFlowPipeline: { nodes: [], edges: [] },
  autonomyModules: [
    {
      name: 'SLAM',
      status: 'Implemented in Codebase',
      nodeName: 'async_slam_toolbox_node',
      packageSource: 'slam_toolbox',
      evidence: 'Configured in turtlebot4_navigation/launch/slam.launch.py',
      configFiles: ['turtlebot4_navigation/config/slam.yaml'],
    },
    {
      name: 'Localization',
      status: 'Implemented in Codebase',
      nodeName: 'amcl',
      packageSource: 'nav2_amcl',
      evidence: 'Launched via turtlebot4_navigation/launch/localization.launch.py',
      configFiles: ['turtlebot4_navigation/config/localization.yaml'],
    },
    {
      name: 'Navigation',
      status: 'Implemented in Codebase',
      nodeName: 'nav2_controller',
      packageSource: 'nav2_controller',
      evidence: 'Configured in turtlebot4_navigation/launch/nav2.launch.py with DWB Local Planner',
      configFiles: ['turtlebot4_navigation/config/nav2.yaml'],
    },
  ],
  robotVariants: ['turtlebot4_standard', 'turtlebot4_lite'],
  robotModels: [],
  codebaseReview: [],
  navigationStack: [],
  environments: [],
  externalDependencies: [],
  testCases: [],
  launchFiles: [
    'turtlebot4_navigation/launch/nav2.launch.py',
    'turtlebot4_navigation/launch/slam.launch.py',
    'turtlebot4_navigation/launch/localization.launch.py',
  ],
  yamlConfigFiles: [
    'turtlebot4_navigation/config/nav2.yaml',
    'turtlebot4_navigation/config/slam.yaml',
  ],
  diagnosticsNotice: 'Standard seed profile for ROS 2 TurtleBot 4 (Standard & Lite).',
};

export const TURTLEBOT3_SEED_PROFILE: RobotProfile = {
  id: 'turtlebot3',
  name: 'ROS 2 TurtleBot 3 (Burger & Waffle)',
  repoUrl: 'https://github.com/ROBOTIS-GIT/turtlebot3',
  rosVersion: 'ROS 2 Humble / Iron',
  description:
    'The standard educational and research mobile robot by ROBOTIS, powered by OpenCR control board, DYNAMIXEL smart actuators, 360° LDS laser distance sensor, and Raspberry Pi.',
  packages: [
    {
      name: 'turtlebot3_description',
      version: '2.1.5',
      description: '3D CAD models, STL meshes, and URDF kinematics for Burger, Waffle, and Waffle Pi',
      buildType: 'ament_cmake',
      dependencies: ['urdf'],
      folderPath: 'turtlebot3_description',
    },
    {
      name: 'turtlebot3_navigation2',
      version: '2.1.5',
      description: 'Nav2 configurations and map parameters for TurtleBot 3 autonomous navigation',
      buildType: 'ament_cmake',
      dependencies: ['nav2_bringup'],
      folderPath: 'turtlebot3_navigation2',
    },
    {
      name: 'turtlebot3_cartographer',
      version: '2.1.5',
      description: 'Google Cartographer 2D/3D real-time SLAM configurations',
      buildType: 'ament_cmake',
      dependencies: ['cartographer_ros'],
      folderPath: 'turtlebot3_cartographer',
    },
  ],
  chassis: {
    length: 0.138,
    width: 0.178,
    height: 0.192,
    wheelbase: 0.160,
    wheelRadius: 0.033,
    totalMassKg: 1.0,
    centerOfGravity: { x: -0.01, y: 0.0, z: 0.07 },
    inertia: { ixx: 0.005, iyy: 0.005, izz: 0.007 },
    maxSpeedLinearMs: 0.22,
    maxSpeedAngularRads: 2.84,
  },
  sensors: [
    {
      id: 'sensor_lds_01',
      name: '360° Laser Distance Sensor (LDS-01/02)',
      type: '2D 360° Laser Scanner (LiDAR)',
      linkName: 'base_scan',
      parentLink: 'base_link',
      position: { x: -0.032, y: 0.0, z: 0.172 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: 'base_scan',
      collisionType: 'cylinder',
      mass: 0.125,
      detailedParams: [
        { label: 'Distance Range', value: '0.12 - 3.5', unit: 'm', category: 'performance' },
        { label: 'Scan Rate', value: '300 ± 10', unit: 'rpm', category: 'performance' },
        { label: 'Sampling Rate', value: '1.8', unit: 'kHz', category: 'optical' },
      ],
      meshUrl: 'https://raw.githubusercontent.com/ROBOTIS-GIT/turtlebot3/humble/turtlebot3_description/meshes/sensors/lds.stl',
      sourceFile: 'turtlebot3_description/urdf/turtlebot3_burger.urdf.xacro',
    },
    {
      id: 'sensor_imu_tb3',
      name: 'OpenCR Embedded 6-Axis IMU',
      type: 'Inertial Measurement Unit (IMU)',
      linkName: 'imu_link',
      parentLink: 'base_link',
      position: { x: 0.0, y: 0.0, z: 0.058 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: 'imu_link',
      collisionType: 'box',
      mass: 0.01,
      detailedParams: [
        { label: 'Gyroscope Range', value: '±2000', unit: 'dps', category: 'imu' },
        { label: 'Accelerometer Range', value: '±16', unit: 'g', category: 'imu' },
      ],
      sourceFile: 'turtlebot3_description/urdf/turtlebot3_burger.urdf.xacro',
    },
  ],
  simulationPlugins: [
    {
      name: 'TurtleBot3DiffDrive',
      targetLink: 'base_link',
      sensorType: 'DifferentialDrive',
      pluginSystem: 'Isaac Sim PhysX / Gazebo',
      rosTopic: '/cmd_vel',
      rosMessageType: 'geometry_msgs/msg/Twist',
    },
    {
      name: 'LdsRaycastPlugin',
      targetLink: 'base_scan',
      sensorType: 'RaycastLiDAR',
      pluginSystem: 'Isaac Sim RTX Lidar',
      updateRateHz: 5,
      rosTopic: '/scan',
      rosMessageType: 'sensor_msgs/msg/LaserScan',
    },
  ],
  topics: [
    { topic: '/scan', type: 'sensor_msgs/msg/LaserScan', direction: 'Publisher', nodeOwner: 'turtlebot3_lds', description: '360° laser distance sensor scan' },
    { topic: '/cmd_vel', type: 'geometry_msgs/msg/Twist', direction: 'Subscriber', nodeOwner: 'turtlebot3_node', description: 'Motor drive commands' },
    { topic: '/odom', type: 'nav_msgs/msg/Odometry', direction: 'Publisher', nodeOwner: 'turtlebot3_node', description: 'Wheel encoder odometry' },
    { topic: '/imu', type: 'sensor_msgs/msg/Imu', direction: 'Publisher', nodeOwner: 'turtlebot3_node', description: 'OpenCR IMU sensor stream' },
    { topic: '/battery_state', type: 'sensor_msgs/msg/BatteryState', direction: 'Publisher', nodeOwner: 'turtlebot3_node', description: 'LiPo battery voltage & level' },
  ],
  sensorToModuleMappings: [],
  dataFlowPipeline: { nodes: [], edges: [] },
  autonomyModules: [
    {
      name: 'SLAM',
      status: 'Implemented in Codebase',
      nodeName: 'cartographer_node',
      packageSource: 'cartographer_ros',
      evidence: 'Configured in turtlebot3_cartographer/launch/cartographer.launch.py',
      configFiles: ['turtlebot3_cartographer/config/turtlebot3_lds_2d.lua'],
    },
    {
      name: 'Navigation',
      status: 'Implemented in Codebase',
      nodeName: 'nav2_bringup',
      packageSource: 'nav2_bringup',
      evidence: 'Configured in turtlebot3_navigation2/launch/navigation2.launch.py',
      configFiles: ['turtlebot3_navigation2/param/burger.yaml'],
    },
  ],
  robotVariants: ['burger', 'waffle', 'waffle_pi'],
  robotModels: [],
  codebaseReview: [],
  navigationStack: [],
  environments: [],
  externalDependencies: [],
  testCases: [],
  launchFiles: [
    'turtlebot3_navigation2/launch/navigation2.launch.py',
    'turtlebot3_cartographer/launch/cartographer.launch.py',
    'turtlebot3_bringup/launch/robot.launch.py',
  ],
  yamlConfigFiles: ['turtlebot3_navigation2/param/burger.yaml'],
  diagnosticsNotice: 'Standard seed profile for ROS 2 TurtleBot 3 (Burger & Waffle).',
};

export async function seedRoboticsFleetAndEnvironments(userId: string): Promise<{ seededProjects: number; seededRobots: number }> {
  const db = getDb();
  if (!db) {
    console.log('[SEED] Neon DB not configured, skipping seed.');
    return { seededProjects: 0, seededRobots: 0 };
  }

  console.log('[SEED] Seeding robotics fleet (Andino, TurtleBot 4, TurtleBot 3)...');

  const seedEntries = [
    {
      projectId: 'proj_andino',
      projectName: 'Ekumen Andino Mobile Base',
      projectDesc: 'Autonomous indoor differential drive research robot with RPLiDAR and Nav2 stack.',
      repoId: 'repo_andino_1',
      repoUrl: 'https://github.com/Ekumen-OS/andino',
      repoName: 'andino',
      branch: 'humble',
      profile: ANDINO_SEED_PROFILE,
    },
    {
      projectId: 'proj_turtlebot4',
      projectName: 'ROS 2 TurtleBot 4',
      projectDesc: 'Standard & Lite TurtleBot 4 built on iRobot Create 3, RPLiDAR, and OAK-D stereo depth camera.',
      repoId: 'repo_tb4_1',
      repoUrl: 'https://github.com/turtlebot/turtlebot4',
      repoName: 'turtlebot4',
      branch: 'humble',
      profile: TURTLEBOT4_SEED_PROFILE,
    },
    {
      projectId: 'proj_turtlebot3',
      projectName: 'ROS 2 TurtleBot 3',
      projectDesc: 'Standard educational and research mobile robot by ROBOTIS (Burger & Waffle models).',
      repoId: 'repo_tb3_1',
      repoUrl: 'https://github.com/ROBOTIS-GIT/turtlebot3',
      repoName: 'turtlebot3',
      branch: 'humble',
      profile: TURTLEBOT3_SEED_PROFILE,
    },
  ];

  let seededProjects = 0;
  let seededRobots = 0;

  for (const entry of seedEntries) {
    // 1. Upsert Project
    await db
      .insert(schema.projects)
      .values({
        id: entry.projectId,
        userId,
        name: entry.projectName,
        description: entry.projectDesc,
      })
      .onConflictDoNothing();
    seededProjects++;

    // 2. Upsert Project Repository
    await db
      .insert(schema.projectRepositories)
      .values({
        id: entry.repoId,
        projectId: entry.projectId,
        repoUrl: entry.repoUrl,
        repoName: entry.repoName,
        branch: entry.branch,
        isPrimary: true,
      })
      .onConflictDoNothing();

    // 3. Upsert Audited Robot Record
    const robotId = `robot_${entry.profile.id}`;
    await db
      .insert(schema.robots)
      .values({
        id: robotId,
        userId,
        projectId: entry.projectId,
        repoUrl: entry.repoUrl,
        repoName: entry.repoName,
        robotName: entry.profile.name,
        rosVersion: entry.profile.rosVersion,
        sensorCount: entry.profile.sensors.length,
        moduleCount: entry.profile.autonomyModules.length,
        profileJson: entry.profile,
      })
      .onConflictDoUpdate({
        target: [schema.robots.userId, schema.robots.repoUrl],
        set: {
          projectId: entry.projectId,
          repoName: entry.repoName,
          robotName: entry.profile.name,
          rosVersion: entry.profile.rosVersion,
          sensorCount: entry.profile.sensors.length,
          moduleCount: entry.profile.autonomyModules.length,
          profileJson: entry.profile,
          analyzedAt: new Date(),
        },
      });
    seededRobots++;
  }

  console.log(`[SEED] Completed! Seeded ${seededProjects} projects and ${seededRobots} audited robot profiles.`);
  return { seededProjects, seededRobots };
}
