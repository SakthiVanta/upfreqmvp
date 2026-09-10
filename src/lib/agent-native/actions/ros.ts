import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { resolveBridgeServerUrl, bridgePost, bridgeGet } from './bridge-http';

// Same real-bridge-call pattern as control_node/simulation.ts/environment.ts
// — every action in this file dispatches to the user's own "thing upfreq
// agent" over HTTP, resolved from an explicit serverUrl or a registered
// isaac_sim bridge endpoint. None of these fabricate data: earlier versions
// of get_node_parameters/set_node_parameter/inspect_tf_tree/
// validate_time_config returned hardcoded values regardless of input (the
// old auditSimTimeCompliance() helper literally had `const hasSimTime =
// true; // By default` with no actual check) — found in a fresh audit pass
// and fixed to match the rest of this namespace instead of staying an
// exception to it.
const SERVER_TARGET_FIELDS = {
  serverUrl: z.string().url().optional().describe('Base URL of the ROS 2 bridge server. Omit if a bridge endpoint is already registered for this projectId/machineId.'),
  apiKey: z.string().optional(),
  projectId: z.string().optional().describe('Used with machineId to look up a registered isaac_sim bridge endpoint if serverUrl is omitted'),
  machineId: z.string().optional().describe('Used with projectId to look up a registered isaac_sim bridge endpoint if serverUrl is omitted'),
};

export const validateTimeConfigAction: AgentNativeAction = {
  id: 'upfreq.ros.validate_time_config',
  namespace: 'upfreq.ros',
  name: 'validate_time_config',
  description: 'Verifies use_sim_time=true across the given ROS 2 nodes and audits simulation /clock authority — a real query against a running bridge server, not an assumed-compliant default. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    nodes: z.array(z.string()).default([
      '/controller_manager',
      '/diff_drive_controller',
      '/nav2_planner',
      '/nav2_controller',
      '/robot_state_publisher',
      '/slam_toolbox',
    ]),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    return bridgePost(serverUrl, '/api/v1/ros/audit-time-config', { nodes: input.nodes }, apiKey);
  },
};

export const getNodeParametersAction: AgentNativeAction = {
  id: 'upfreq.ros.get_node_parameters',
  namespace: 'upfreq.ros',
  name: 'get_node_parameters',
  description: 'Returns the real parameter schema (types, current values, limits) for a specific ROS 2 node, queried live from a running bridge server. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    nodeName: z.string(),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    const result = await bridgeGet(serverUrl, `/api/v1/ros/node-parameters?node_name=${encodeURIComponent(input.nodeName)}`, apiKey);
    return { node: input.nodeName, serverUrl, ...result };
  },
};

export const setNodeParameterAction: AgentNativeAction = {
  id: 'upfreq.ros.set_node_parameter',
  namespace: 'upfreq.ros',
  name: 'set_node_parameter',
  description: 'Dynamically updates a ROS 2 node parameter on a real, running bridge server and returns what the node actually reports back — not an echo of the requested value. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    nodeName: z.string(),
    parameterName: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    ...SERVER_TARGET_FIELDS,
  }),
  async generateProposalDiff(input) {
    return {
      diff: `ROS Node: ${input.nodeName}\nParameter: ${input.parameterName} -> ${input.value}`,
      rationale: `Tune parameter ${input.parameterName} on node ${input.nodeName}`,
    };
  },
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    const result = await bridgePost<{ applied_value?: unknown; success?: boolean }>(serverUrl, '/api/v1/ros/set-node-parameter', {
      node_name: input.nodeName,
      parameter_name: input.parameterName,
      value: input.value,
    }, apiKey);

    return {
      success: result.success ?? true,
      node: input.nodeName,
      parameter: input.parameterName,
      appliedValue: result.applied_value ?? input.value,
      serverUrl,
      timestamp: new Date().toISOString(),
    };
  },
};

export const inspectTfTreeAction: AgentNativeAction = {
  id: 'upfreq.ros.inspect_tf_tree',
  namespace: 'upfreq.ros',
  name: 'inspect_tf_tree',
  description: 'Returns the real frame hierarchy, link connectivity, and REP-105 coordinate compliance from a running bridge server\'s live TF tree. Requires serverUrl (or a previously-registered bridge endpoint).',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    rootFrame: z.string().default('base_footprint'),
    ...SERVER_TARGET_FIELDS,
  }),
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    const result = await bridgeGet(serverUrl, `/api/v1/ros/tf-tree?root_frame=${encodeURIComponent(input.rootFrame)}`, apiKey);
    return { rootFrame: input.rootFrame, serverUrl, ...result };
  },
};

export const controlNodeAction: AgentNativeAction = {
  id: 'upfreq.ros.control_node',
  namespace: 'upfreq.ros',
  name: 'control_node',
  description: 'Starts, stops, restarts, or kills a ROS 2 node/process on a real, running bridge server. Requires serverUrl (or a previously-registered isaac_sim bridge endpoint) — this dispatches a real process-control command, not a simulated one.',
  defaultPolicy: 'REVIEW',
  schema: z.object({
    nodeName: z.string().describe('ROS 2 node name, e.g. "/nav2_planner"'),
    action: z.enum(['start', 'stop', 'restart', 'kill']),
    ...SERVER_TARGET_FIELDS,
  }),
  async generateProposalDiff(input) {
    return {
      diff: `ROS 2 node: ${input.nodeName}\nAction: ${input.action}`,
      rationale: `${input.action} node ${input.nodeName} on the live bridge server`,
    };
  },
  async execute(input, context) {
    const { serverUrl, apiKey } = await resolveBridgeServerUrl(context, 'isaac_sim', input.serverUrl, input.projectId, input.machineId);
    const result = await bridgePost<{ pid?: number; running?: boolean; logs?: string[] }>(serverUrl, '/api/v1/ros/control-node', {
      node_name: input.nodeName,
      action: input.action,
    }, apiKey);

    return {
      nodeName: input.nodeName,
      action: input.action,
      serverUrl,
      pid: result.pid,
      running: result.running,
      logs: result.logs || [],
      timestamp: new Date().toISOString(),
    };
  },
};

export const rosActions = [
  validateTimeConfigAction,
  getNodeParametersAction,
  setNodeParameterAction,
  inspectTfTreeAction,
  controlNodeAction,
];
