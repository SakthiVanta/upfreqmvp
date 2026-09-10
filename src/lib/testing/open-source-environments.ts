import { SimEnvironmentPreset } from './types';

export interface OpenSourceEnvironment {
  id: SimEnvironmentPreset;
  name: string;
  tagline: string;
  category: 'logistics' | 'healthcare' | 'retail' | 'benchmark' | 'calibration' | 'terrain';
  openSourceRepo: string;
  sourcePackage: string;
  license: string;
  description: string;
  dimensions: { lengthM: number; widthM: number; heightM: number };
  obstacleDensity: 'low' | 'medium' | 'high';
  lightingType: 'studio' | 'warehouse_fluorescent' | 'hospital_interior' | 'retail_warm' | 'outdoor_sun';
  recommendedRobots: string[];
  features: string[];
  defaultWorldFile: string;
  isaacStagePreset: string;
}

export const OPEN_SOURCE_ENVIRONMENTS: OpenSourceEnvironment[] = [
  {
    id: 'warehouse',
    name: 'AWS RoboMaker Small Warehouse',
    tagline: 'Standard Logistics & AMR Obstacle Clearing Environment',
    category: 'logistics',
    openSourceRepo: 'https://github.com/aws-robotics/aws-robomaker-small-warehouse-world',
    sourcePackage: 'aws_robomaker_small_warehouse_world',
    license: 'Apache 2.0',
    description:
      'Industrial warehouse logistics simulation featuring 8 high-bay pallet racking units, wooden shipping pallets, cardboard cargo boxes, drop carts, and dedicated AMR recharge docking bays. Designed for tuning autonomous obstacle avoidance and narrow aisle navigation.',
    dimensions: { lengthM: 20.0, widthM: 20.0, heightM: 6.5 },
    obstacleDensity: 'medium',
    lightingType: 'warehouse_fluorescent',
    recommendedRobots: ['TurtleBot 4', 'Andino Base', 'Clearpath Ridgeback', 'OTTO 100'],
    features: [
      'Industrial pallet rack corridors (2.2m aisle width)',
      'Multiple static cardboard obstacle clusters',
      'Realistic floor friction & boundary painted lines',
      'Isaac Sim RTX fluorescent overhead lighting arrays',
    ],
    defaultWorldFile: 'worlds/small_warehouse.world',
    isaacStagePreset: 'warehouse',
  },
  {
    id: 'turtlebot_world',
    name: 'ROBOTIS TurtleBot3 Hexagonal Arena',
    tagline: 'Iconic SLAM & LiDAR Benchmarking Maze',
    category: 'benchmark',
    openSourceRepo: 'https://github.com/ROBOTIS-GIT/turtlebot3_simulations',
    sourcePackage: 'turtlebot3_gazebo',
    license: 'Apache 2.0',
    description:
      'The classic 4m x 4m hexagonal pillar arena from ROBOTIS. Features a 3x3 layout of cylindrical and hexagonal obstacle columns specifically designed for verifying 2D LiDAR raycast occlusions, Cartographer SLAM loop closures, and Nav2 costmap inflation radii.',
    dimensions: { lengthM: 4.0, widthM: 4.0, heightM: 1.0 },
    obstacleDensity: 'high',
    lightingType: 'studio',
    recommendedRobots: ['TurtleBot 3 Burger', 'TurtleBot 3 Waffle', 'TurtleBot 4 Lite', 'Andino'],
    features: [
      '9 hexagonal and cylindrical obstacle columns',
      'High-contrast boundary perimeter walls',
      'Optimized for fast SLAM map convergence testing',
      'Isaac Sim raycast validation stage',
    ],
    defaultWorldFile: 'worlds/turtlebot3_world.world',
    isaacStagePreset: 'turtlebot_world',
  },
  {
    id: 'hospital',
    name: 'AWS RoboMaker Hospital World',
    tagline: 'Healthcare Clinic Layout for Service & Disinfection Robots',
    category: 'healthcare',
    openSourceRepo: 'https://github.com/aws-robotics/aws-robomaker-hospital-world',
    sourcePackage: 'aws_robomaker_hospital_world',
    license: 'Apache 2.0',
    description:
      'Clinical facility environment containing a central nursing station, patient examination rooms, hospital beds, rolling IV poles, elevator vestibules, and double swinging corridor doors. Ideal for healthcare service robots and social navigation testing.',
    dimensions: { lengthM: 25.0, widthM: 15.0, heightM: 3.5 },
    obstacleDensity: 'high',
    lightingType: 'hospital_interior',
    recommendedRobots: ['TurtleBot 4 Standard', 'Aethon TUG', 'Fetch Freight', 'MiR 100'],
    features: [
      'Corridor doorway clearance and navigation',
      'High-specular linoleum floor material simulation',
      'Fine obstacle detection (bed legs, IV stand poles)',
      'Multi-room topological navigation graph',
    ],
    defaultWorldFile: 'worlds/hospital.world',
    isaacStagePreset: 'hospital',
  },
  {
    id: 'bookstore',
    name: 'AWS RoboMaker Bookstore World',
    tagline: 'Commercial Retail Shop for Inventory & Tight-Radius AMRs',
    category: 'retail',
    openSourceRepo: 'https://github.com/aws-robotics/aws-robomaker-bookstore-world',
    sourcePackage: 'aws_robomaker_bookstore_world',
    license: 'Apache 2.0',
    description:
      'Multi-aisle retail bookstore containing wooden bookshelves, checkout counters, magazine racks, and cafe seating. Perfect for validating tight turning kinematics, visual RGB-D depth perception, and feature-rich visual SLAM.',
    dimensions: { lengthM: 15.0, widthM: 12.0, heightM: 3.8 },
    obstacleDensity: 'high',
    lightingType: 'retail_warm',
    recommendedRobots: ['TurtleBot 4 Lite', 'TurtleBot 3 Waffle Pi', 'Balyo', 'Simbe Tally'],
    features: [
      'Narrow retail aisles (1.2m width)',
      'Dense visual textures for feature tracking',
      'Low-profile table and chair leg obstacles',
      'Raytraced interior warm lighting',
    ],
    defaultWorldFile: 'worlds/bookstore.world',
    isaacStagePreset: 'bookstore',
  },
  {
    id: 'incline',
    name: '15° Incline Slope & Dynamic Ramp',
    tagline: 'Dynamic Tip-Over & Wheel Traction Testing Platform',
    category: 'terrain',
    openSourceRepo: 'https://github.com/NVIDIA-Omniverse/IsaacSim-ros_workspaces',
    sourcePackage: 'isaac_sim_physics_stages',
    license: 'NVIDIA Isaac Sim Community',
    description:
      'Engineered 15-degree continuous incline ramp stage with variable PhysX friction coefficients. Specifically built to measure center-of-mass safety envelopes, brake hold capabilities, motor torque saturation, and wheel slippage ratios on slopes.',
    dimensions: { lengthM: 10.0, widthM: 5.0, heightM: 2.5 },
    obstacleDensity: 'low',
    lightingType: 'outdoor_sun',
    recommendedRobots: ['TurtleBot 4', 'Andino Base', 'TurtleBot 3', 'Rover Bases'],
    features: [
      'Calibrated 15.0° incline plane',
      'Dynamic pitch angle telemetry measurement',
      'Configurable static/dynamic friction (mu = 0.8)',
      'PhysX 5 rigid body contact reporting',
    ],
    defaultWorldFile: 'stages/incline_ramp.usd',
    isaacStagePreset: 'incline',
  },
  {
    id: 'rough_terrain',
    name: 'Rough Terrain Elevation Course',
    tagline: 'Outdoor Uneven Heightmap with Suspension Travel Obstacles',
    category: 'terrain',
    openSourceRepo: 'https://github.com/NVIDIA-Omniverse/IsaacSim-ros_workspaces',
    sourcePackage: 'isaac_sim_physics_stages',
    license: 'NVIDIA Isaac Sim Community',
    description:
      'Outdoor uneven elevation terrain with staggered 0.05m - 0.12m geometric bumps, stone-like collision shapes, and varying surface slopes. Ideal for verifying chassis clearance, caster wheel suspension travel, and vibration resilience.',
    dimensions: { lengthM: 12.0, widthM: 12.0, heightM: 1.5 },
    obstacleDensity: 'medium',
    lightingType: 'outdoor_sun',
    recommendedRobots: ['Andino Base', 'TurtleBot 4', 'Husky UGV', 'Jackal UGV'],
    features: [
      'Multi-level geometric height variation',
      'Chassis bottoming-out detection',
      'Caster wheel hang-up risk evaluation',
      'Wheel suspension displacement analysis',
    ],
    defaultWorldFile: 'stages/rough_terrain.usd',
    isaacStagePreset: 'rough_terrain',
  },
  {
    id: 'grid',
    name: 'Metric Precision Calibration Grid',
    tagline: 'Sub-Millimeter 0.1m Coordinate Stage for Kinematics',
    category: 'calibration',
    openSourceRepo: 'https://github.com/NVIDIA-Omniverse/IsaacSim-ros_workspaces',
    sourcePackage: 'isaac_sim_calibration',
    license: 'NVIDIA Isaac Sim Community',
    description:
      'High-contrast metric coordinate plane with 0.1m minor grid markings and 1.0m major axes. Designed for kinematic joint sweep validation, wheel odometry calibration, and zero-interference sensor frustum verification.',
    dimensions: { lengthM: 50.0, widthM: 50.0, heightM: 10.0 },
    obstacleDensity: 'low',
    lightingType: 'studio',
    recommendedRobots: ['All Robots'],
    features: [
      'Sub-millimeter calibrated Cartesian grid plane',
      'Clean background for RTX raytracing & WebRTC stream',
      'Zero collision obstacles for unconstrained testing',
      'Studio ambient DomeLight lighting',
    ],
    defaultWorldFile: 'stages/grid.usd',
    isaacStagePreset: 'grid',
  },
];
