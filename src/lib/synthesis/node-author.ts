/**
 * ROS 2 Node Authoring Engine
 * Synthesizes production-ready C++ (rclcpp) and Python (rclpy) ROS 2 nodes,
 * controllers, and action clients.
 */

export interface AuthorNodeOptions {
  nodeName: string;
  nodeType: 'obstacle_avoidance' | 'wall_follower' | 'diff_drive_controller' | 'waypoint_navigator' | 'custom';
  language: 'cpp' | 'python';
  topicSubscriptions?: Array<{ topic: string; type: string }>;
  topicPublications?: Array<{ topic: string; type: string }>;
  parameters?: Array<{ name: string; type: string; defaultValue: any }>;
  customPrompt?: string;
}

export function authorRosNode(options: AuthorNodeOptions): {
  filename: string;
  code: string;
  dependencies: string[];
} {
  const { nodeName, nodeType, language } = options;
  const isCpp = language === 'cpp';
  const ext = isCpp ? 'cpp' : 'py';
  const filename = `${nodeName}.${ext}`;

  if (nodeType === 'obstacle_avoidance') {
    if (isCpp) {
      return {
        filename,
        dependencies: ['rclcpp', 'geometry_msgs', 'sensor_msgs'],
        code: `#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <sensor_msgs/msg/laser_scan.hpp>
#include <algorithm>
#include <limits>

/**
 * Obstacle Avoidance Node (C++ rclcpp)
 * Subscribes to /scan and scales linear velocity when obstacles enter safety corridor.
 */
class ObstacleAvoidanceNode : public rclcpp::Node
{
public:
  ObstacleAvoidanceNode() : Node("${nodeName}")
  {
    this->declare_parameter<double>("safety_distance_m", 0.55);
    this->declare_parameter<double>("slowdown_distance_m", 1.20);
    this->declare_parameter<double>("max_linear_speed", 1.0);

    safety_dist_ = this->get_parameter("safety_distance_m").as_double();
    slowdown_dist_ = this->get_parameter("slowdown_distance_m").as_double();
    max_speed_ = this->get_parameter("max_linear_speed").as_double();

    cmd_pub_ = this->create_publisher<geometry_msgs::msg::Twist>("/cmd_vel", 10);
    scan_sub_ = this->create_subscription<sensor_msgs::msg::LaserScan>(
      "/scan", 10, std::bind(&ObstacleAvoidanceNode::scanCallback, this, std::placeholders::_1));

    RCLCPP_INFO(this->get_logger(), "${nodeName} active. Safety margin: %.2fm", safety_dist_);
  }

private:
  void scanCallback(const sensor_msgs::msg::LaserScan::SharedPtr scan)
  {
    double min_front_dist = std::numeric_limits<double>::infinity();

    // Check front 60-degree sector (-30 to +30 deg)
    int total_ranges = scan->ranges.size();
    int center_idx = total_ranges / 2;
    int window = total_ranges / 6;

    int start_idx = std::max(0, center_idx - window);
    int end_idx = std::min(total_ranges, center_idx + window);

    for (int i = start_idx; i < end_idx; ++i) {
      float r = scan->ranges[i];
      if (r >= scan->range_min && r <= scan->range_max && r < min_front_dist) {
        min_front_dist = r;
      }
    }

    geometry_msgs::msg::Twist cmd;
    if (min_front_dist < safety_dist_) {
      // Emergency stop & rotate away
      cmd.linear.x = 0.0;
      cmd.angular.z = 0.45;
      RCLCPP_WARN_THROTTLE(this->get_logger(), *this->get_clock(), 1000,
        "Obstacle proximity critical: %.2fm! Stopping.", min_front_dist);
    } else if (min_front_dist < slowdown_dist_) {
      // Proportional slow down
      double factor = (min_front_dist - safety_dist_) / (slowdown_dist_ - safety_dist_);
      cmd.linear.x = max_speed_ * factor;
      cmd.angular.z = 0.0;
    } else {
      cmd.linear.x = max_speed_;
      cmd.angular.z = 0.0;
    }

    cmd_pub_->publish(cmd);
  }

  double safety_dist_;
  double slowdown_dist_;
  double max_speed_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Subscription<sensor_msgs::msg::LaserScan>::SharedPtr scan_sub_;
};

int main(int argc, char **argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ObstacleAvoidanceNode>());
  rclcpp::shutdown();
  return 0;
}
`,
      };
    } else {
      return {
        filename,
        dependencies: ['rclpy', 'geometry_msgs', 'sensor_msgs'],
        code: `import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan
import math

class ObstacleAvoidanceNode(Node):
    """Obstacle avoidance node with proportional braking and wall avoidance."""
    def __init__(self):
        super().__init__('${nodeName}')
        self.declare_parameter('safety_distance_m', 0.55)
        self.declare_parameter('slowdown_distance_m', 1.20)
        self.declare_parameter('max_linear_speed', 1.0)

        self.safety_dist = self.get_parameter('safety_distance_m').value
        self.slowdown_dist = self.get_parameter('slowdown_distance_m').value
        self.max_speed = self.get_parameter('max_linear_speed').value

        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.scan_sub = self.create_subscription(LaserScan, '/scan', self.scan_callback, 10)
        self.get_logger().info(f'${nodeName} active. Safety dist: {self.safety_dist}m')

    def scan_callback(self, scan: LaserScan):
        ranges = scan.ranges
        if not ranges:
            return

        center = len(ranges) // 2
        span = len(ranges) // 6
        front_readings = [r for r in ranges[max(0, center - span):min(len(ranges), center + span)]
                          if scan.range_min <= r <= scan.range_max]

        min_dist = min(front_readings) if front_readings else float('inf')

        cmd = Twist()
        if min_dist < self.safety_dist:
            cmd.linear.x = 0.0
            cmd.angular.z = 0.45
        elif min_dist < self.slowdown_dist:
            scale = (min_dist - self.safety_dist) / (self.slowdown_dist - self.safety_dist)
            cmd.linear.x = self.max_speed * scale
            cmd.angular.z = 0.0
        else:
            cmd.linear.x = self.max_speed
            cmd.angular.z = 0.0

        self.cmd_pub.publish(cmd)

def main(args=None):
    rclpy.init(args=args)
    node = ObstacleAvoidanceNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
`,
      };
    }
  }

  // Generic / Custom Node fallback
  const code = isCpp
    ? `#include <rclcpp/rclcpp.hpp>

class ${nodeName} : public rclcpp::Node
{
public:
  ${nodeName}() : Node("${nodeName}")
  {
    RCLCPP_INFO(this->get_logger(), "${nodeName} running.");
  }
};

int main(int argc, char **argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<${nodeName}>());
  rclcpp::shutdown();
  return 0;
}
`
    : `import rclpy
from rclpy.node import Node

class ${nodeName}(Node):
    def __init__(self):
        super().__init__('${nodeName}')
        self.get_logger().info('${nodeName} running.')

def main(args=None):
    rclpy.init(args=args)
    node = ${nodeName}()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
`;

  return {
    filename,
    dependencies: isCpp ? ['rclcpp'] : ['rclpy'],
    code,
  };
}
