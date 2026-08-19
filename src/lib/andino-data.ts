export interface SensorRecord {
  id: string;
  name: string;
  type: string;
  linkName: string;
  parentLink: string;
  position: { x: number; y: number; z: number };
  orientation: { r: number; p: number; y: number };
  frameId: string;
  visualMesh: string;
  collisionType: string;
  mass: number;
}

export interface SensorDatasheet {
  sensorName: string;
  type: string;
  parameters: { label: string; value: string }[];
}

export interface GazeboPluginRecord {
  name: string;
  targetLink: string;
  sensorType: string;
  pluginSystem: string;
  updateRateHz: number;
  gzTopic: string;
  rosTopic: string;
  rosMessageType: string;
  additionalConfig: Record<string, string>;
}

export interface TopicRecord {
  topic: string;
  type: string;
  direction: 'Publisher' | 'Subscriber' | 'Bridge';
  nodeOwner: string;
  description: string;
}

export interface RobotProfile {
  name: string;
  repoUrl: string;
  rosVersion: string;
  description: string;
  chassis: {
    length: number;
    width: number;
    height: number;
    wheelbase: number;
    wheelRadius: number;
    totalMassKg: number;
  };
  sensors: SensorRecord[];
  datasheets: SensorDatasheet[];
  gazeboPlugins: GazeboPluginRecord[];
  topics: TopicRecord[];
  launchFiles: string[];
}

export const ANDINO_BENCHMARK: RobotProfile = {
  name: "Ekumen Andino",
  repoUrl: "https://github.com/Ekumen-OS/andino",
  rosVersion: "ROS 2 Humble / Iron / Rolling",
  description: "Low-cost, open-source differential-drive mobile robot platform designed for ROS 2 research, navigation, and Gazebo/Ignition simulation.",
  chassis: {
    length: 0.22,
    width: 0.18,
    height: 0.12,
    wheelbase: 0.16,
    wheelRadius: 0.033,
    totalMassKg: 1.45,
  },
  sensors: [
    {
      id: "rplidar-a1",
      name: "SLAMTEC RPLidar A1M8",
      type: "2D Laser Scanner (LiDAR)",
      linkName: "rplidar_laser_link",
      parentLink: "lidar_base_link",
      position: { x: 0.0666, y: 0.0, z: 0.084808 },
      orientation: { r: 0.0, p: 0.0, y: 3.14159 },
      frameId: "rplidar_laser_link",
      visualMesh: "rplidar-a1.stl",
      collisionType: "Cylinder (r=0.015m, l=0.01m)",
      mass: 0.10,
    },
    {
      id: "rpi-camera-v2",
      name: "Raspberry Pi Camera Module V2",
      type: "8MP RGB USB/CSI Camera",
      linkName: "camera_link",
      parentLink: "base_link",
      position: { x: 0.0980, y: 0.0, z: 0.0250 },
      orientation: { r: 0.0, p: 0.0, y: 0.0 },
      frameId: "camera_link",
      visualMesh: "camera_mount.stl",
      collisionType: "Box (0.02m x 0.02m x 0.02m)",
      mass: 0.10,
    }
  ],
  datasheets: [
    {
      sensorName: "SLAMTEC RPLidar A1M8",
      type: "360° 2D Laser Triangulation Scanner",
      parameters: [
        { label: "Measuring Range", value: "0.15 m – 12.0 m" },
        { label: "Sampling Frequency", value: "8,000 samples/sec" },
        { label: "Scan Rate", value: "5.5 Hz (2–10 Hz configurable)" },
        { label: "Angular Resolution", value: "≤ 1.0° (at 5.5 Hz)" },
        { label: "Distance Resolution", value: "< 0.5 mm" },
        { label: "Laser Wavelength", value: "785 nm (Class 1 Eye-Safe)" },
        { label: "Interface / Baudrate", value: "3.3V TTL UART @ 115200 baud" },
        { label: "Scan Mode in Andino", value: "Sensitivity" },
        { label: "Recommended Domain", value: "Indoor Mobile Navigation & SLAM" },
      ]
    },
    {
      sensorName: "Raspberry Pi Camera Module V2",
      type: "CMOS Image Sensor (Sony IMX219)",
      parameters: [
        { label: "Sensor Resolution", value: "8 Megapixels (3280 × 2464 px)" },
        { label: "Video Formats", value: "1080p @ 30fps, 720p @ 60fps" },
        { label: "Optical Format", value: "1/4 inch" },
        { label: "Pixel Size", value: "1.12 µm × 1.12 µm" },
        { label: "Focal Length / Aperture", value: "3.04 mm, F2.0" },
        { label: "Field of View (FOV)", value: "62.2° (H) × 48.8° (V)" },
        { label: "Interface Driver", value: "Video4Linux2 (v4l2_camera node)" },
        { label: "Dimensions & Weight", value: "25 × 23 × 9 mm, ~3 grams" }
      ]
    }
  ],
  gazeboPlugins: [
    {
      name: "Ignition GPU LiDAR System",
      targetLink: "rplidar_laser_link",
      sensorType: "gpu_lidar",
      pluginSystem: "libignition-gazebo-sensors-system.so",
      updateRateHz: 10.0,
      gzTopic: "/world/default/model/andino/sensor/sensor_ray_front/scan",
      rosTopic: "/scan",
      rosMessageType: "sensor_msgs/msg/LaserScan",
      additionalConfig: {
        "Horizontal Samples": "720",
        "Min Angle": "-3.14159265 rad (-180°)",
        "Max Angle": "+3.14159265 rad (+180°)",
        "Range Limits": "0.20m to 12.0m",
        "Noise Profile": "Gaussian (mean: 0.0, stddev: 0.01)"
      }
    },
    {
      name: "Ignition Camera Sensor System",
      targetLink: "camera_link",
      sensorType: "camera",
      pluginSystem: "libignition-gazebo-sensors-system.so",
      updateRateHz: 30.0,
      gzTopic: "/world/default/model/andino/sensor/camera/image",
      rosTopic: "/image_raw",
      rosMessageType: "sensor_msgs/msg/Image",
      additionalConfig: {
        "Resolution": "640 x 480 px",
        "Horizontal FOV": "1.047 rad (~60°)",
        "Clip Planes": "Near: 0.1m, Far: 100m",
        "Associated Info Topic": "/camera_info (sensor_msgs/msg/CameraInfo)"
      }
    },
    {
      name: "DiffDrive Plugin",
      targetLink: "base_link",
      sensorType: "actuator_controller",
      pluginSystem: "ignition-gazebo-diff-drive-system",
      updateRateHz: 50.0,
      gzTopic: "/model/andino/cmd_vel",
      rosTopic: "/cmd_vel",
      rosMessageType: "geometry_msgs/msg/Twist",
      additionalConfig: {
        "Wheel Separation": "0.16 m",
        "Wheel Diameter": "0.066 m",
        "Odometry Topic": "/odom (nav_msgs/msg/Odometry)"
      }
    }
  ],
  topics: [
    {
      topic: "/scan",
      type: "sensor_msgs/msg/LaserScan",
      direction: "Publisher",
      nodeOwner: "rplidar_node / ros_gz_bridge",
      description: "2D laser range scan for SLAM (Cartographer/Nav2)"
    },
    {
      topic: "/scan/points",
      type: "sensor_msgs/msg/PointCloud2",
      direction: "Publisher",
      nodeOwner: "ros_gz_bridge",
      description: "3D pointcloud conversion of LiDAR scan"
    },
    {
      topic: "/image_raw",
      type: "sensor_msgs/msg/Image",
      direction: "Publisher",
      nodeOwner: "v4l2_camera / ros_gz_bridge",
      description: "Raw RGB camera frame stream"
    },
    {
      topic: "/camera_info",
      type: "sensor_msgs/msg/CameraInfo",
      direction: "Publisher",
      nodeOwner: "v4l2_camera / ros_gz_bridge",
      description: "Camera calibration & intrinsic matrix parameters"
    },
    {
      topic: "/cmd_vel",
      type: "geometry_msgs/msg/Twist",
      direction: "Subscriber",
      nodeOwner: "andino_base_node / ros_gz_bridge",
      description: "Linear/Angular velocity motor commands"
    },
    {
      topic: "/odom",
      type: "nav_msgs/msg/Odometry",
      direction: "Publisher",
      nodeOwner: "diff_drive_controller / ros_gz_bridge",
      description: "Wheel odometry position and velocity estimate"
    },
    {
      topic: "/tf",
      type: "tf2_msgs/msg/TFMessage",
      direction: "Publisher",
      nodeOwner: "robot_state_publisher",
      description: "Kinematic transform tree base_link -> laser/camera links"
    }
  ],
  launchFiles: [
    "andino_bringup/launch/andino_robot.launch.py",
    "andino_bringup/launch/rplidar.launch.py",
    "andino_bringup/launch/camera.launch.py",
    "andino_control/launch/andino_control.launch.py",
    "andino_gz/launch/andino_gz.launch.py"
  ]
};
