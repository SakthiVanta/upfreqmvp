/**
 * ROS 2 Package Scaffolder
 * Generates idiomatic ament_cmake and ament_python packages matching ROS 2 Jazzy/Humble standards.
 */

export interface ScaffoldingOptions {
  packageName: string;
  buildType: 'ament_cmake' | 'ament_python';
  description?: string;
  maintainerEmail?: string;
  maintainerName?: string;
  license?: string;
  dependencies?: string[];
  nodes?: Array<{
    nodeName: string;
    language: 'cpp' | 'python';
  }>;
}

export interface GeneratedPackageFiles {
  packageName: string;
  files: Record<string, string>; // path -> content
}

export function scaffoldRosPackage(options: ScaffoldingOptions): GeneratedPackageFiles {
  const pkg = options.packageName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const description = options.description || `ROS 2 package for ${pkg}`;
  const email = options.maintainerEmail || 'engineer@upfreq.ai';
  const name = options.maintainerName || 'UpFreq Engineer';
  const license = options.license || 'Apache-2.0';
  const deps = options.dependencies || ['rclcpp', 'std_msgs', 'geometry_msgs', 'sensor_msgs'];

  const files: Record<string, string> = {};

  // 1. package.xml (Common to both)
  files['package.xml'] = `<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>${pkg}</name>
  <version>0.1.0</version>
  <description>${description}</description>
  <maintainer email="${email}">${name}</maintainer>
  <license>${license}</license>

  <buildtool_depend>${options.buildType}</buildtool_depend>

${deps.map(d => `  <depend>${d}</depend>`).join('\n')}

  <test_depend>ament_lint_auto</test_depend>
  <test_depend>ament_lint_common</test_depend>

  <export>
    <build_type>${options.buildType}</build_type>
  </export>
</package>
`;

  if (options.buildType === 'ament_cmake') {
    // 2. CMakeLists.txt
    files['CMakeLists.txt'] = `cmake_minimum_required(VERSION 3.8)
project(${pkg})

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Find dependencies
find_package(ament_cmake REQUIRED)
${deps.map(d => `find_package(${d} REQUIRED)`).join('\n')}

# Include directories
include_directories(include)

# Executables
${(options.nodes || [{ nodeName: `${pkg}_node`, language: 'cpp' }]).map(n => `add_executable(${n.nodeName} src/${n.nodeName}.cpp)
ament_target_dependencies(${n.nodeName}
  ${deps.join('\n  ')}
)

install(TARGETS ${n.nodeName}
  DESTINATION lib/\${PROJECT_NAME}
)
`).join('\n')}

install(DIRECTORY include/
  DESTINATION include/
)

install(DIRECTORY launch config
  DESTINATION share/\${PROJECT_NAME}
  FILES_MATCHING PATTERN "*.py" PATTERN "*.yaml"
)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
`;

    // 3. Default C++ node
    const firstNode = options.nodes?.[0]?.nodeName || `${pkg}_node`;
    files[`src/${firstNode}.cpp`] = `#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <sensor_msgs/msg/laser_scan.hpp>

class ${toPascalCase(firstNode)} : public rclcpp::Node
{
public:
  ${toPascalCase(firstNode)}() : Node("${firstNode}")
  {
    RCLCPP_INFO(this->get_logger(), "${firstNode} initialized under UpFreq runtime.");
    cmd_pub_ = this->create_publisher<geometry_msgs::msg::Twist>("/cmd_vel", 10);
    scan_sub_ = this->create_subscription<sensor_msgs::msg::LaserScan>(
      "/scan", 10, std::bind(&${toPascalCase(firstNode)}::scanCallback, this, std::placeholders::_1));
  }

private:
  void scanCallback(const sensor_msgs::msg::LaserScan::SharedPtr msg)
  {
    (void)msg;
    // Real software fidelity logic
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Subscription<sensor_msgs::msg::LaserScan>::SharedPtr scan_sub_;
};

int main(int argc, char **argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<${toPascalCase(firstNode)}>());
  rclcpp::shutdown();
  return 0;
}
`;
  } else {
    // ament_python package
    files['setup.py'] = `from setuptools import find_packages, setup

package_name = '${pkg}'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='${name}',
    maintainer_email='${email}',
    description='${description}',
    license='${license}',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            '${pkg}_node = ${pkg}.${pkg}_node:main',
        ],
    },
)
`;
    files['setup.cfg'] = `[develop]
script_dir=$base/lib/${pkg}
[install]
install_scripts=$base/lib/${pkg}
`;
    files[`${pkg}/__init__.py`] = '';
    files[`${pkg}/${pkg}_node.py`] = `import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan

class ${toPascalCase(pkg)}Node(Node):
    def __init__(self):
        super().__init__('${pkg}_node')
        self.get_logger().info('${pkg}_node running on UpFreq orchestration plane.')
        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.scan_sub = self.create_subscription(LaserScan, '/scan', self.scan_callback, 10)

    def scan_callback(self, msg: LaserScan):
        pass

def main(args=None):
    rclpy.init(args=args)
    node = ${toPascalCase(pkg)}Node()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
`;
  }

  return {
    packageName: pkg,
    files,
  };
}

function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}
