import { AssetContract } from './contract';

export interface RegistryAssetRecord {
  id: string;
  assetId: string;
  version: string;
  type: 'robot_mobile' | 'robot_manipulator' | 'environment' | 'sensor';
  visibility: 'public' | 'private';
  contract: AssetContract;
  storageUri: string;
  nvmeCachePath: string;
  physicsScore: number;
}

export const CANONICAL_REGISTRY_ASSETS: RegistryAssetRecord[] = [
  {
    id: 'asset_amr_2_1_0',
    assetId: 'warehouse_amr',
    version: '2.1.0',
    type: 'robot_mobile',
    visibility: 'public',
    physicsScore: 94,
    storageUri: 's3://upfreq-canonical-assets/robots/warehouse_amr@2.1.0.usd',
    nvmeCachePath: '/cache/assets/robots/warehouse_amr@2.1.0/',
    contract: {
      asset: {
        id: 'warehouse_amr',
        version: '2.1.0',
        type: 'robot_mobile',
        visibility: 'public',
        description: 'Standard differential drive AMR for logistics and material transport.',
      },
      runtime_requirements: {
        ros_distribution: 'jazzy',
        simulators_supported: [{ isaac_sim: '4.1.0' }, { newton_physics: '1.6.0' }],
        gpu: { min_vram_gb: 16 },
      },
      dependencies: {
        ros_packages: ['nav2_bringup', 'ros2_control', 'diff_drive_controller'],
      },
      interfaces: {
        command: [{ name: '/cmd_vel', type: 'geometry_msgs/msg/Twist' }],
        state: [
          { name: '/odom', type: 'nav_msgs/msg/Odometry' },
          { name: '/joint_states', type: 'sensor_msgs/msg/JointState' },
          { name: '/scan', type: 'sensor_msgs/msg/LaserScan' },
        ],
      },
      frames: {
        root: 'base_footprint',
        required: ['base_link', 'lidar_link', 'wheel_left_link', 'wheel_right_link'],
      },
      simulation_profile: {
        mass_kg: 52.4,
        drive_type: 'differential',
        max_linear_velocity: 1.8,
        max_angular_velocity: 2.5,
      },
      validation: {
        status: 'verified',
        validator_version: '1.2.0',
        physics_score: 94,
      },
    },
  },
  {
    id: 'asset_env_warehouse_1_4_0',
    assetId: 'logistics_warehouse_v2',
    version: '1.4.0',
    type: 'environment',
    visibility: 'public',
    physicsScore: 98,
    storageUri: 's3://upfreq-canonical-assets/environments/warehouse_v2@1.4.0.usd',
    nvmeCachePath: '/cache/assets/environments/warehouse_v2@1.4.0/',
    contract: {
      asset: {
        id: 'logistics_warehouse_v2',
        version: '1.4.0',
        type: 'environment',
        visibility: 'public',
        description: 'Industrial automated fulfillment warehouse with high-bay shelving, pallet stacks, and dynamic obstacles.',
      },
      runtime_requirements: {
        ros_distribution: 'jazzy',
        simulators_supported: [{ isaac_sim: '4.1.0' }, { newton_physics: '1.6.0' }],
      },
      dependencies: { ros_packages: [] },
      interfaces: { command: [], state: [] },
      frames: { root: 'map', required: ['map', 'shelving_bay_1', 'docking_station_a'] },
      validation: { status: 'verified', validator_version: '1.2.0', physics_score: 98 },
    },
  },
  {
    id: 'asset_sensor_sick_1_0_0',
    assetId: 'sick_tim571_lidar',
    version: '1.0.0',
    type: 'sensor',
    visibility: 'public',
    physicsScore: 95,
    storageUri: 's3://upfreq-canonical-assets/sensors/sick_tim571@1.0.0.usd',
    nvmeCachePath: '/cache/assets/sensors/sick_tim571@1.0.0/',
    contract: {
      asset: {
        id: 'sick_tim571_lidar',
        version: '1.0.0',
        type: 'sensor',
        visibility: 'public',
        description: 'SICK TiM571 2D LiDAR with 270 deg aperture, 25m range, and 15 Hz scan rate.',
      },
      runtime_requirements: { ros_distribution: 'jazzy', simulators_supported: [{ isaac_sim: '4.1.0' }] },
      dependencies: { ros_packages: ['sensor_msgs'] },
      interfaces: { command: [], state: [{ name: '/scan', type: 'sensor_msgs/msg/LaserScan' }] },
      frames: { root: 'lidar_link', required: ['lidar_link'] },
      validation: { status: 'verified', validator_version: '1.2.0', physics_score: 95 },
    },
  },
];

export function listRegistryAssets(filterType?: string): RegistryAssetRecord[] {
  if (!filterType || filterType === 'all') return CANONICAL_REGISTRY_ASSETS;
  return CANONICAL_REGISTRY_ASSETS.filter(a => a.type === filterType);
}

export function getRegistryAsset(assetId: string): RegistryAssetRecord | undefined {
  return CANONICAL_REGISTRY_ASSETS.find(a => a.assetId === assetId || a.id === assetId);
}
