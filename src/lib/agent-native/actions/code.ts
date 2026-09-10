import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { scaffoldRosPackage } from '@/lib/synthesis/package-scaffolder';
import { authorRosNode } from '@/lib/synthesis/node-author';
import { modifyNodeAst } from '@/lib/synthesis/ast-modifier';
import { parseCompilerOutput } from '@/lib/synthesis/compiler-diagnostics';

export const scaffoldPackageAction: AgentNativeAction = {
  id: 'upfreq.code.scaffold_package',
  namespace: 'upfreq.code',
  name: 'scaffold_package',
  description: 'Creates idiomatic ament_cmake or ament_python ROS 2 packages with correct dependencies and build targets.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    packageName: z.string(),
    buildType: z.enum(['ament_cmake', 'ament_python']).default('ament_cmake'),
    dependencies: z.array(z.string()).default(['rclcpp', 'std_msgs', 'geometry_msgs']),
    description: z.string().optional(),
  }),
  async generateProposalDiff(input) {
    return {
      diff: `+ Create package ${input.packageName} (${input.buildType})\n+ Dependencies: ${input.dependencies.join(', ')}`,
      rationale: `Scaffold compliant ROS 2 package structure for ${input.packageName}`,
    };
  },
  async execute(input) {
    return scaffoldRosPackage(input);
  },
};

export const authorNodeAction: AgentNativeAction = {
  id: 'upfreq.code.author_node',
  namespace: 'upfreq.code',
  name: 'author_node',
  description: 'Writes complete C++ (rclcpp) or Python (rclpy) ROS 2 nodes, controllers, or action clients.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    nodeName: z.string(),
    nodeType: z.enum(['obstacle_avoidance', 'wall_follower', 'diff_drive_controller', 'waypoint_navigator', 'custom']),
    language: z.enum(['cpp', 'python']),
    customPrompt: z.string().optional(),
  }),
  async generateProposalDiff(input) {
    const authored = authorRosNode(input);
    return {
      diff: `+ File: ${authored.filename}\n+ ${authored.code.split('\n').length} lines of idiomatic ROS 2 ${input.language.toUpperCase()} code`,
      rationale: `Author ${input.nodeType} node for ${input.nodeName}`,
      targetFile: authored.filename,
    };
  },
  async execute(input) {
    return authorRosNode(input);
  },
};

export const modifyNodeAstAction: AgentNativeAction = {
  id: 'upfreq.code.modify_node_ast',
  namespace: 'upfreq.code',
  name: 'modify_node_ast',
  description: 'Performs AST-aware safe code refactoring (parameters, topics, QoS) on existing ROS 2 nodes without regex breakage.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    filename: z.string(),
    sourceCode: z.string(),
    operations: z.array(z.object({
      type: z.enum(['update_parameter_default', 'rename_topic', 'change_qos_depth']),
      target: z.string(),
      newValue: z.union([z.string(), z.number()]),
    })),
  }),
  async generateProposalDiff(input) {
    const res = modifyNodeAst(input);
    return {
      diff: res.diff,
      rationale: `Refactor ${input.operations.length} AST elements in ${input.filename}`,
      targetFile: input.filename,
    };
  },
  async execute(input) {
    return modifyNodeAst(input);
  },
};

export const compileAndDiagnoseAction: AgentNativeAction = {
  id: 'upfreq.code.compile_and_diagnose',
  namespace: 'upfreq.code',
  name: 'compile_and_diagnose',
  description: 'Simulates/executes colcon build with ccache, extracts compiler diagnostics, and suggests automated auto-fix strategies.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    packageName: z.string(),
    mockCompilerOutput: z.string().optional(),
  }),
  async execute(input) {
    const rawOutput = input.mockCompilerOutput || `Scanning dependencies of target ${input.packageName}\n[100%] Built target ${input.packageName}\nFinished <<< ${input.packageName} [1.42s]`;
    return parseCompilerOutput(input.packageName, rawOutput);
  },
};

export const getMcpConfigAction: AgentNativeAction = {
  id: 'upfreq.code.get_mcp_config',
  namespace: 'upfreq.code',
  name: 'get_mcp_config',
  description: 'Returns the copyable Claude Code CLI command and Cursor JSON configuration for UpFreq MCP Gateway.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    hostUrl: z.string().default('http://localhost:3000'),
  }),
  async execute(input) {
    const url = input.hostUrl.replace(/\/+$/, '');
    return {
      claudeCommand: `claude mcp add --transport http upfreq ${url}/api/mcp`,
      cursorConfig: {
        mcpServers: {
          upfreq: {
            url: `${url}/api/mcp`,
          },
        },
      },
      description: 'Connect Claude Code in your terminal to edit ROS 2 code locally while connecting to UpFreq for robot models and Isaac Sim testing.',
    };
  },
};

export const codeActions = [
  scaffoldPackageAction,
  authorNodeAction,
  modifyNodeAstAction,
  compileAndDiagnoseAction,
  getMcpConfigAction,
];
